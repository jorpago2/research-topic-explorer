import { calculateShare, chunkArray, mergeGroupedCounts } from "../../lib/analysis";
import { mapWithConcurrency } from "../../lib/concurrency";
import type { AnalysisResult, JournalResultRow } from "../../types/domain";
import { CLIENT_GROUP_CONCURRENCY, CLIENT_SOURCE_CHUNK_SIZE, fetchAllGroupedPages } from "../topic-ranking/service";

export async function loadJournalBreakdown(analysis: AnalysisResult, signal?: AbortSignal): Promise<JournalResultRow[]> {
  const sourceChunks = chunkArray(analysis.coverage.uniqueSources.map((source) => source.id).sort(), CLIENT_SOURCE_CHUNK_SIZE);
  const results = await mapWithConcurrency(sourceChunks, CLIENT_GROUP_CONCURRENCY, (sourceIds) =>
    fetchAllGroupedPages("/v1/group-sources", {
      sourceIds,
      year: analysis.year,
      types: analysis.documentTypes,
      cursor: "*",
    }, signal),
  );
  return mergeGroupedCounts(results.map((result) => result.groups)).map((group) => ({
    sourceId: group.id,
    journal: group.displayName,
    documents: group.count,
    share: calculateShare(group.count, analysis.analyzedDocuments),
  }));
}
