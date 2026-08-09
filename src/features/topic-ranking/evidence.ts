import { chunkArray } from "../../lib/analysis";
import { apiRequest } from "../../lib/api/client";
import { topicEvidenceSchema } from "../../lib/api/schemas";
import { mapWithConcurrency } from "../../lib/concurrency";
import type { AnalysisResult, TopicEvidenceResult } from "../../types/domain";
import { CLIENT_GROUP_CONCURRENCY, CLIENT_SOURCE_CHUNK_SIZE, scopeRequestForAnalysis } from "./service";

const EVIDENCE_LIMIT = 8;

export async function loadTopicEvidence(analysis: AnalysisResult, topicId: string, signal?: AbortSignal): Promise<TopicEvidenceResult> {
  const sourceChunks = chunkArray(analysis.coverage.uniqueSources.map((source) => source.id).sort(), CLIENT_SOURCE_CHUNK_SIZE);
  const scopeRequest = scopeRequestForAnalysis(analysis);
  const responses = await mapWithConcurrency(sourceChunks, CLIENT_GROUP_CONCURRENCY, (sourceIds) => apiRequest("/v1/topic-evidence", topicEvidenceSchema, {
    sourceIds,
    topicId,
    year: analysis.year,
    types: analysis.documentTypes,
    limit: EVIDENCE_LIMIT,
    ...scopeRequest,
  }, signal));
  const works = [...new Map(responses.flatMap((response) => response.works).map((work) => [work.id, work])).values()]
    .sort((a, b) => b.citedByCount - a.citedByCount || a.title.localeCompare(b.title))
    .slice(0, EVIDENCE_LIMIT);
  return { selectionMethod: "most-cited-primary-topic-matches", works };
}
