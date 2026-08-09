import { calculateShare, calculateYoYGrowth, chunkArray, mergeGroupedCounts } from "../../lib/analysis";
import { apiRequest } from "../../lib/api/client";
import { actorSnapshotSchema, groupedSchema, topicImpactSchema } from "../../lib/api/schemas";
import { mapWithConcurrency } from "../../lib/concurrency";
import type { ActorComparisonRow, ActorDimension, AnalysisResult, EmergingActorsResult, GroupRow, PeriodComparisonResult, PeriodRange, TopicImpactResult, TopicImpactSummary, TopicLifecycleSignal, TopicLifecycleStatus, TrendPoint } from "../../types/domain";
import { CLIENT_GROUP_CONCURRENCY, CLIENT_SOURCE_CHUNK_SIZE, scopeRequestForAnalysis } from "../topic-ranking/service";

export const DEFAULT_TREND_TOPIC_COUNT = 10;
export const MAX_TREND_TOPICS = 12;
export const COMPARISON_PERIOD_OPTIONS = [2, 3, 5] as const;
export const MIN_GROWTH_BASE = 20;
export const MIN_LIFECYCLE_RECENT_DOCUMENTS = 50;
export const MIN_LIFECYCLE_SHARE_CHANGE = 0.0005;
export const MAX_ACTOR_ROWS = 12;

export async function loadTrends(
  analysis: AnalysisResult,
  startYear: number,
  endYear: number,
  topicIds: string[],
  signal?: AbortSignal,
): Promise<TrendPoint[]> {
  const selectedTopics = analysis.ranking.filter((topic) => topicIds.includes(topic.topicId)).slice(0, MAX_TREND_TOPICS);
  const scopeRequest = scopeRequestForAnalysis(analysis);
  const sourceChunks = chunkArray(analysis.coverage.uniqueSources.map((source) => source.id).sort(), CLIENT_SOURCE_CHUNK_SIZE);
  const categoryResults = await mapWithConcurrency(sourceChunks, CLIENT_GROUP_CONCURRENCY, (sourceIds) =>
    apiRequest("/v1/group-category-years", groupedSchema, {
      sourceIds,
      startYear,
      endYear,
      types: analysis.documentTypes,
      ...scopeRequest,
    }, signal),
  );
  const categoryCounts = toYearMap(mergeGroupedCounts(categoryResults.map((result) => result.groups)));

  const topicResults = await mapWithConcurrency(selectedTopics, CLIENT_GROUP_CONCURRENCY, async (topic) => {
    const chunks = await mapWithConcurrency(sourceChunks, CLIENT_GROUP_CONCURRENCY, (sourceIds) =>
      apiRequest("/v1/group-topic-years", groupedSchema, {
        sourceIds,
        topicId: topic.topicId,
        startYear,
        endYear,
        types: analysis.documentTypes,
        ...scopeRequest,
      }, signal),
    );
    return { topic, counts: toYearMap(mergeGroupedCounts(chunks.map((result) => result.groups))) };
  });

  return topicResults.flatMap(({ topic, counts }) => {
    const points: TrendPoint[] = [];
    for (let year = startYear; year <= endYear; year += 1) {
      const documents = counts.get(year) ?? 0;
      const previous = year > startYear ? counts.get(year - 1) ?? 0 : null;
      const categoryDocuments = categoryCounts.get(year) ?? 0;
      points.push({
        topicId: topic.topicId,
        topic: topic.name,
        year,
        documents,
        categoryDocuments,
        share: calculateShare(documents, categoryDocuments),
        yoyGrowth: previous !== null && previous >= MIN_GROWTH_BASE ? calculateYoYGrowth(documents, previous) : null,
      });
    }
    return points;
  });
}

function toYearMap(groups: GroupRow[]): Map<number, number> {
  return new Map(groups.filter((group) => /^\d{4}$/.test(group.id)).map((group) => [Number(group.id), group.count]));
}

export function buildPeriodComparison(points: TrendPoint[], endYear: number, yearsPerPeriod: number): PeriodComparisonResult {
  if (!COMPARISON_PERIOD_OPTIONS.includes(yearsPerPeriod as (typeof COMPARISON_PERIOD_OPTIONS)[number])) {
    throw new Error("Comparison periods must contain 2, 3, or 5 years.");
  }
  const periodB = { startYear: endYear - yearsPerPeriod + 1, endYear };
  const periodA = { startYear: periodB.startYear - yearsPerPeriod, endYear: periodB.startYear - 1 };
  const topicIds = [...new Set(points.map((point) => point.topicId))];
  const categoryByYear = new Map<number, number>();
  for (const point of points) categoryByYear.set(point.year, point.categoryDocuments);
  const categoryA = sumYears(categoryByYear, periodA.startYear, periodA.endYear);
  const categoryB = sumYears(categoryByYear, periodB.startYear, periodB.endYear);
  const counts = topicIds.map((topicId) => {
    const topicPoints = points.filter((point) => point.topicId === topicId);
    return {
      topicId,
      topic: topicPoints[0]?.topic ?? topicId,
      periodACount: topicPoints.filter((point) => point.year >= periodA.startYear && point.year <= periodA.endYear).reduce((sum, point) => sum + point.documents, 0),
      periodBCount: topicPoints.filter((point) => point.year >= periodB.startYear && point.year <= periodB.endYear).reduce((sum, point) => sum + point.documents, 0),
    };
  });
  const rankA = rankCounts(counts.map((row) => [row.topicId, row.periodACount] as const));
  const rankB = rankCounts(counts.map((row) => [row.topicId, row.periodBCount] as const));
  return {
    periodA,
    periodB,
    rows: counts.map((row) => {
      const periodAAnnualAverage = row.periodACount / yearsPerPeriod;
      const periodBAnnualAverage = row.periodBCount / yearsPerPeriod;
      return {
        ...row,
        periodAAnnualAverage,
        periodBAnnualAverage,
        periodAShare: categoryA ? row.periodACount / categoryA : 0,
        periodBShare: categoryB ? row.periodBCount / categoryB : 0,
        annualRateChange: periodAAnnualAverage ? (periodBAnnualAverage - periodAAnnualAverage) / periodAAnnualAverage : null,
        rankA: rankA.get(row.topicId) ?? topicIds.length,
        rankB: rankB.get(row.topicId) ?? topicIds.length,
        rankChange: (rankA.get(row.topicId) ?? topicIds.length) - (rankB.get(row.topicId) ?? topicIds.length),
      };
    }).sort((a, b) => b.periodBAnnualAverage - a.periodBAnnualAverage || a.topic.localeCompare(b.topic)),
  };
}

export function buildLifecycleSignals(points: TrendPoint[], endYear: number, yearsPerPeriod: number): TopicLifecycleSignal[] {
  const comparison = buildPeriodComparison(points, endYear, yearsPerPeriod);
  return comparison.rows.map((row) => {
    const topicPoints = points.filter((point) => point.topicId === row.topicId);
    const previousSlope = shareSlope(topicPoints, comparison.periodA);
    const recentSlope = shareSlope(topicPoints, comparison.periodB);
    const shareChange = row.periodBShare - row.periodAShare;
    const hasCompleteCorpus = topicPoints
      .filter((point) => point.year >= comparison.periodA.startYear && point.year <= comparison.periodB.endYear)
      .every((point) => point.categoryDocuments > 0);
    return {
      topicId: row.topicId,
      topic: row.topic,
      status: lifecycleStatus(row.periodACount, row.periodBCount, shareChange, recentSlope, recentSlope - previousSlope, hasCompleteCorpus),
      periodACount: row.periodACount,
      periodBCount: row.periodBCount,
      periodAShare: row.periodAShare,
      periodBShare: row.periodBShare,
      shareChange,
      recentShareSlope: recentSlope,
      acceleration: recentSlope - previousSlope,
    };
  }).sort((a, b) => statusOrder(a.status) - statusOrder(b.status) || b.shareChange - a.shareChange || b.periodBCount - a.periodBCount);
}

export async function loadTopicImpact(
  analysis: AnalysisResult,
  startYear: number,
  endYear: number,
  topicId: string,
  trendPoints: TrendPoint[],
  signal?: AbortSignal,
): Promise<TopicImpactResult> {
  const topic = analysis.ranking.find((row) => row.topicId === topicId);
  if (!topic) throw new Error("The selected Topic is not part of this analysis.");
  const scopeRequest = scopeRequestForAnalysis(analysis);
  const sourceChunks = chunkArray(analysis.coverage.uniqueSources.map((source) => source.id).sort(), CLIENT_SOURCE_CHUNK_SIZE);
  const responses = await mapWithConcurrency(sourceChunks, CLIENT_GROUP_CONCURRENCY, (sourceIds) => apiRequest("/v1/topic-impact-years", topicImpactSchema, {
    sourceIds,
    topicId,
    startYear,
    endYear,
    types: analysis.documentTypes,
    ...scopeRequest,
  }, signal));
  const top10 = toYearMap(mergeGroupedCounts(responses.map((response) => response.top10.groups)));
  const top1 = toYearMap(mergeGroupedCounts(responses.map((response) => response.top1.groups)));
  const documents = new Map(trendPoints.filter((point) => point.topicId === topicId).map((point) => [point.year, point.documents]));
  return {
    topicId,
    topic: topic.name,
    points: Array.from({ length: endYear - startYear + 1 }, (_, index) => {
      const year = startYear + index;
      const denominator = documents.get(year) ?? 0;
      const top10Documents = Math.min(denominator, top10.get(year) ?? 0);
      const top1Documents = Math.min(top10Documents, top1.get(year) ?? 0);
      return { year, documents: denominator, top10Documents, top1Documents, top10Rate: calculateShare(top10Documents, denominator), top1Rate: calculateShare(top1Documents, denominator) };
    }),
  };
}

export function buildImpactSummary(impact: TopicImpactResult, endYear: number, yearsPerPeriod: number): TopicImpactSummary {
  const periodB = { startYear: endYear - yearsPerPeriod + 1, endYear };
  const periodA = { startYear: periodB.startYear - yearsPerPeriod, endYear: periodB.startYear - 1 };
  const aggregate = (period: PeriodRange) => {
    const selected = impact.points.filter((point) => point.year >= period.startYear && point.year <= period.endYear);
    const documents = selected.reduce((sum, point) => sum + point.documents, 0);
    return {
      top10: calculateShare(selected.reduce((sum, point) => sum + point.top10Documents, 0), documents),
      top1: calculateShare(selected.reduce((sum, point) => sum + point.top1Documents, 0), documents),
    };
  };
  const a = aggregate(periodA);
  const b = aggregate(periodB);
  return { periodA, periodB, top10RateA: a.top10, top10RateB: b.top10, top1RateA: a.top1, top1RateB: b.top1 };
}

export async function loadEmergingActors(
  analysis: AnalysisResult,
  topicId: string,
  periodA: PeriodRange,
  periodB: PeriodRange,
  signal?: AbortSignal,
): Promise<EmergingActorsResult> {
  const topic = analysis.ranking.find((row) => row.topicId === topicId);
  if (!topic) throw new Error("The selected Topic is not part of this analysis.");
  const sourceChunks = chunkArray(analysis.coverage.uniqueSources.map((source) => source.id).sort(), CLIENT_SOURCE_CHUNK_SIZE);
  const scopeRequest = scopeRequestForAnalysis(analysis);
  const tasks = (["country", "institution"] as const).flatMap((dimension) => ([periodA, periodB] as const).map((period, periodIndex) => ({ dimension, period, periodIndex })));
  const snapshots = await mapWithConcurrency(tasks, CLIENT_GROUP_CONCURRENCY, async ({ dimension, period, periodIndex }) => {
    const chunks = await mapWithConcurrency(sourceChunks, CLIENT_GROUP_CONCURRENCY, (sourceIds) => apiRequest("/v1/topic-actors", actorSnapshotSchema, {
      sourceIds,
      topicId,
      startYear: period.startYear,
      endYear: period.endYear,
      types: analysis.documentTypes,
      dimension,
      ...scopeRequest,
    }, signal));
    return { dimension, periodIndex, groups: mergeGroupedCounts(chunks.map((chunk) => chunk.groups)), truncated: chunks.some((chunk) => chunk.truncated) };
  });
  const rowsFor = (dimension: ActorDimension) => buildActorRows(
    snapshots.find((snapshot) => snapshot.dimension === dimension && snapshot.periodIndex === 0)?.groups ?? [],
    snapshots.find((snapshot) => snapshot.dimension === dimension && snapshot.periodIndex === 1)?.groups ?? [],
    dimension === "country" ? 10 : 5,
  );
  return {
    topicId,
    topic: topic.name,
    periodA,
    periodB,
    countries: rowsFor("country"),
    institutions: rowsFor("institution"),
    truncated: snapshots.some((snapshot) => snapshot.truncated),
  };
}

function buildActorRows(periodA: GroupRow[], periodB: GroupRow[], minimumRecentCount: number): ActorComparisonRow[] {
  const a = new Map(periodA.map((row) => [row.id, row]));
  const b = new Map(periodB.map((row) => [row.id, row]));
  const rankA = rankCounts(periodA.map((row) => [row.id, row.count] as const));
  const rankB = rankCounts(periodB.map((row) => [row.id, row.count] as const));
  const fallbackRankA = periodA.length + 1;
  const fallbackRankB = periodB.length + 1;
  return [...new Set([...a.keys(), ...b.keys()])].map((id) => {
    const periodACount = a.get(id)?.count ?? 0;
    const periodBCount = b.get(id)?.count ?? 0;
    const oldRank = rankA.get(id) ?? fallbackRankA;
    const newRank = rankB.get(id) ?? fallbackRankB;
    return {
      id,
      name: b.get(id)?.displayName ?? a.get(id)?.displayName ?? id,
      periodACount,
      periodBCount,
      countChange: periodBCount - periodACount,
      relativeChange: periodACount ? (periodBCount - periodACount) / periodACount : null,
      rankA: oldRank,
      rankB: newRank,
      rankChange: oldRank - newRank,
    };
  }).filter((row) => row.periodBCount >= minimumRecentCount && row.countChange > 0)
    .sort((left, right) => right.countChange - left.countChange || right.rankChange - left.rankChange || right.periodBCount - left.periodBCount)
    .slice(0, MAX_ACTOR_ROWS);
}

function shareSlope(points: TrendPoint[], period: PeriodRange): number {
  const selected = points.filter((point) => point.year >= period.startYear && point.year <= period.endYear);
  if (selected.length < 2) return 0;
  const meanYear = selected.reduce((sum, point) => sum + point.year, 0) / selected.length;
  const meanShare = selected.reduce((sum, point) => sum + point.share, 0) / selected.length;
  const denominator = selected.reduce((sum, point) => sum + (point.year - meanYear) ** 2, 0);
  return denominator ? selected.reduce((sum, point) => sum + (point.year - meanYear) * (point.share - meanShare), 0) / denominator : 0;
}

function lifecycleStatus(baseCount: number, recentCount: number, shareChange: number, recentSlope: number, acceleration: number, completeCorpus: boolean): TopicLifecycleStatus {
  if (!completeCorpus || recentCount < MIN_LIFECYCLE_RECENT_DOCUMENTS) return "insufficient";
  if (baseCount < MIN_LIFECYCLE_RECENT_DOCUMENTS && shareChange >= MIN_LIFECYCLE_SHARE_CHANGE && recentSlope > 0 && acceleration > 0) return "emerging";
  if (shareChange >= MIN_LIFECYCLE_SHARE_CHANGE && recentSlope > 0) return "growing";
  if (shareChange <= -MIN_LIFECYCLE_SHARE_CHANGE && recentSlope < 0) return "declining";
  return "mature";
}

function statusOrder(status: TopicLifecycleStatus): number {
  return ({ emerging: 0, growing: 1, mature: 2, declining: 3, insufficient: 4 })[status];
}

function sumYears(values: Map<number, number>, startYear: number, endYear: number): number {
  let total = 0;
  for (let year = startYear; year <= endYear; year += 1) total += values.get(year) ?? 0;
  return total;
}

function rankCounts(values: Array<readonly [string, number]>): Map<string, number> {
  return new Map([...values].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([id], index) => [id, index + 1]));
}
