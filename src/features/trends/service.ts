import { calculateShare, calculateYoYGrowth, chunkArray, mergeGroupedCounts } from "../../lib/analysis";
import { apiRequest } from "../../lib/api/client";
import { groupedSchema } from "../../lib/api/schemas";
import { mapWithConcurrency } from "../../lib/concurrency";
import type { AnalysisResult, GroupRow, PeriodComparisonResult, TrendPoint } from "../../types/domain";
import { CLIENT_GROUP_CONCURRENCY, CLIENT_SOURCE_CHUNK_SIZE, scopeRequestForAnalysis } from "../topic-ranking/service";

export const DEFAULT_TREND_TOPIC_COUNT = 10;
export const MAX_TREND_TOPICS = 12;
export const COMPARISON_PERIOD_OPTIONS = [2, 3, 5] as const;
export const MIN_GROWTH_BASE = 20;

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

function sumYears(values: Map<number, number>, startYear: number, endYear: number): number {
  let total = 0;
  for (let year = startYear; year <= endYear; year += 1) total += values.get(year) ?? 0;
  return total;
}

function rankCounts(values: Array<readonly [string, number]>): Map<string, number> {
  return new Map([...values].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([id], index) => [id, index + 1]));
}
