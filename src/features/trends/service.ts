import { calculateShare, calculateYoYGrowth, chunkArray, mergeGroupedCounts } from "../../lib/analysis";
import { apiRequest } from "../../lib/api/client";
import { groupedSchema } from "../../lib/api/schemas";
import { mapWithConcurrency } from "../../lib/concurrency";
import type { AnalysisResult, GroupRow, TrendPoint } from "../../types/domain";
import { CLIENT_GROUP_CONCURRENCY, CLIENT_SOURCE_CHUNK_SIZE, scopeRequestForAnalysis } from "../topic-ranking/service";

export const DEFAULT_TREND_TOPIC_COUNT = 10;
export const MAX_TREND_TOPICS = 12;
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
