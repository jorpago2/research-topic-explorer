import { buildCoverageReport, buildTopicRanking, chunkArray, mergeGroupedCounts } from "../../lib/analysis";
import { apiRequest } from "../../lib/api/client";
import { groupedSchema, resolveSourcesSchema, topicDetailsSchema } from "../../lib/api/schemas";
import { mapWithConcurrency } from "../../lib/concurrency";
import { deduplicateIssns } from "../../lib/issn";
import type {
  AnalysisResult,
  CategoryDefinition,
  DocumentTypeMode,
  GroupRow,
  TopicDetails,
} from "../../types/domain";

export const CLIENT_SOURCE_CHUNK_SIZE = 100;
export const CLIENT_GROUP_CONCURRENCY = 2;
export const TOPIC_METADATA_LIMIT = 40;

export type AnalysisPhase = "resolving" | "ranking" | "metadata" | "preparing";

export function documentTypesForMode(mode: DocumentTypeMode): string[] {
  return mode === "article-review" ? ["article", "review"] : [];
}

export async function fetchAllGroupedPages(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<{ groups: GroupRow[]; documentCount: number }> {
  const pages: GroupRow[][] = [];
  let cursor = typeof body.cursor === "string" ? body.cursor : "*";
  let documentCount = 0;
  for (let pageNumber = 0; pageNumber < 2_000; pageNumber += 1) {
    const page = await apiRequest(path, groupedSchema, { ...body, cursor }, signal);
    if (pageNumber === 0) documentCount = page.meta.documentCount;
    pages.push(page.groups);
    if (!page.meta.nextCursor) return { groups: mergeGroupedCounts(pages), documentCount };
    if (page.meta.nextCursor === cursor) throw new Error("The research data service returned a repeated cursor.");
    cursor = page.meta.nextCursor;
  }
  throw new Error("Grouped result paging exceeded the safety limit.");
}

export async function analyzeCategory(
  category: CategoryDefinition,
  year: number,
  documentTypeMode: DocumentTypeMode,
  onPhase: (phase: AnalysisPhase) => void,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  onPhase("resolving");
  const normalizedIssns = deduplicateIssns(category.journals.flatMap((journal) => journal.issns));
  if (normalizedIssns.invalid.length) throw new Error(`The category contains ${normalizedIssns.invalid.length} invalid ISSN value(s).`);
  if (!normalizedIssns.valid.length) throw new Error("This category does not contain any journal identifiers.");
  if (normalizedIssns.valid.length > 500) throw new Error("This category exceeds the 500-ISSN source-resolution limit.");
  const resolution = await apiRequest("/v1/resolve-sources", resolveSourcesSchema, { issns: normalizedIssns.valid }, signal);
  const coverage = buildCoverageReport(category.journals, resolution.sources, resolution.unresolvedIssns);
  if (!coverage.uniqueSources.length) throw new Error("None of the journals in this category could be matched to OpenAlex Sources.");

  onPhase("ranking");
  const sourceChunks = chunkArray(coverage.uniqueSources.map((source) => source.id).sort(), CLIENT_SOURCE_CHUNK_SIZE);
  const documentTypes = documentTypesForMode(documentTypeMode);
  const chunkResults = await mapWithConcurrency(sourceChunks, CLIENT_GROUP_CONCURRENCY, (sourceIds) =>
    fetchAllGroupedPages("/v1/group-primary-topics", { sourceIds, year, types: documentTypes, cursor: "*" }, signal),
  );
  const analyzedDocuments = chunkResults.reduce((sum, result) => sum + result.documentCount, 0);
  const mergedGroups = mergeGroupedCounts(chunkResults.map((result) => result.groups));
  const ranking = buildTopicRanking(mergedGroups, analyzedDocuments);
  const classifiedDocuments = ranking.reduce((sum, topic) => sum + topic.count, 0);

  onPhase("metadata");
  const detailsResponse = ranking.length
    ? await apiRequest("/v1/topic-details", topicDetailsSchema, { topicIds: ranking.slice(0, TOPIC_METADATA_LIMIT).map((topic) => topic.topicId) }, signal)
    : { topics: [] };
  const topicDetails = new Map<string, TopicDetails>(detailsResponse.topics.map((topic) => [topic.id, topic]));

  onPhase("preparing");
  return {
    category,
    year,
    documentTypeMode,
    documentTypes,
    coverage,
    ranking,
    topicDetails,
    analyzedDocuments,
    classifiedDocuments,
    classificationCoverage: analyzedDocuments > 0 ? classifiedDocuments / analyzedDocuments : 0,
    metadata: {
      generatedAt: new Date().toISOString(),
      categoryId: category.id,
      categoryName: category.name,
      taxonomy: category.taxonomy,
      ...(category.edition ? { categoryEdition: category.edition } : {}),
      publicationYear: year,
      documentTypes,
      totalInputJournals: coverage.totalJournals,
      resolvedJournals: coverage.resolvedJournals,
      resolvedSourceIds: coverage.uniqueSources.map((source) => source.id),
      analyzedDocuments,
      classifiedDocuments,
      topicCountingMethod: "openalex-primary-topic",
      networkMethod: "openalex-topic-cooccurrence",
      includeXpac: false,
    },
  };
}
