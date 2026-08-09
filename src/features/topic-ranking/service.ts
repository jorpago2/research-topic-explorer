import { buildCoverageReport, buildTopicRanking, chunkArray, mergeGroupedCounts } from "../../lib/analysis";
import { apiRequest } from "../../lib/api/client";
import { groupedSchema, resolveSourcesSchema, subfieldSourcesSchema, topicDetailsSchema } from "../../lib/api/schemas";
import { mapWithConcurrency } from "../../lib/concurrency";
import { deduplicateIssns } from "../../lib/issn";
import type {
  AnalysisResult,
  CategoryDefinition,
  DocumentTypeMode,
  GroupRow,
  JifDataset,
  JournalImpactMetric,
  OpenAlexSubfield,
  ResolvedSource,
  TopicDetails,
} from "../../types/domain";

export const CLIENT_SOURCE_CHUNK_SIZE = 100;
export const CLIENT_GROUP_CONCURRENCY = 2;
export const TOPIC_METADATA_LIMIT = 40;
export const MAX_DISCOVERED_SOURCES = 100;

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

  return analyzeResolvedJournalSet(category, coverage.uniqueSources, coverage, year, documentTypeMode, onPhase, signal);
}

function matchJifBySource(sources: ResolvedSource[], dataset?: JifDataset | null): Map<string, JournalImpactMetric> {
  if (!dataset) return new Map();
  const byIssn = new Map(dataset.journals.map((metric) => [metric.eissn.toUpperCase(), metric]));
  const result = new Map<string, JournalImpactMetric>();
  for (const source of sources) {
    const metric = [...source.issns, ...(source.issnL ? [source.issnL] : [])]
      .map((issn) => byIssn.get(issn.toUpperCase()))
      .find((value): value is JournalImpactMetric => Boolean(value));
    if (metric) result.set(source.id, metric);
  }
  return result;
}

async function discoverSubfieldSources(subfieldId: string, signal?: AbortSignal): Promise<{ sources: ResolvedSource[]; truncated: boolean }> {
  const response = await apiRequest("/v1/openalex-subfield-sources", subfieldSourcesSchema, { subfieldId, cursor: "*" }, signal);
  const sources = [...new Map(response.sources.map((source) => [source.id, source])).values()];
  return { sources, truncated: sources.length >= MAX_DISCOVERED_SOURCES };
}

export async function analyzeOpenAlexSubfield(
  subfield: OpenAlexSubfield,
  year: number,
  documentTypeMode: DocumentTypeMode,
  jifDataset: JifDataset | null | undefined,
  onPhase: (phase: AnalysisPhase) => void,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  onPhase("resolving");
  const discovery = await discoverSubfieldSources(subfield.id, signal);
  if (!discovery.sources.length) throw new Error("OpenAlex did not return any ISSN-bearing journals for this subfield.");
  const category: CategoryDefinition = {
    schemaVersion: 1,
    id: `openalex-subfield-${subfield.id}`,
    name: subfield.displayName,
    taxonomy: "OpenAlex Subfield",
    sourceNote: "Journal membership is derived from the number of OpenAlex articles and reviews whose primary topic belongs to the selected Subfield.",
    journals: discovery.sources.map((source) => ({ name: source.displayName, issns: source.issns.length ? source.issns : source.issnL ? [source.issnL] : [] })),
  };
  const coverage = buildCoverageReport(category.journals, discovery.sources, []);
  return analyzeResolvedJournalSet(category, discovery.sources, coverage, year, documentTypeMode, onPhase, signal, {
    journalSetMethod: "openalex-primary-subfield-source-groups",
    sourceSetTruncated: discovery.truncated,
    jifDataset,
  });
}

async function analyzeResolvedJournalSet(
  category: CategoryDefinition,
  sources: ResolvedSource[],
  coverage: AnalysisResult["coverage"],
  year: number,
  documentTypeMode: DocumentTypeMode,
  onPhase: (phase: AnalysisPhase) => void,
  signal?: AbortSignal,
  options?: {
    journalSetMethod?: "openalex-primary-subfield-source-groups";
    sourceSetTruncated?: boolean;
    jifDataset?: JifDataset | null;
  },
): Promise<AnalysisResult> {

  onPhase("ranking");
  const sourceChunks = chunkArray(sources.map((source) => source.id).sort(), CLIENT_SOURCE_CHUNK_SIZE);
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
  const jifBySourceId = matchJifBySource(sources, options?.jifDataset);

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
    jifBySourceId,
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
      ...(options?.journalSetMethod ? { journalSetMethod: options.journalSetMethod } : {}),
      ...(options?.sourceSetTruncated !== undefined ? { sourceSetTruncated: options.sourceSetTruncated } : {}),
      ...(options?.jifDataset ? { jifEdition: options.jifDataset.edition } : {}),
    },
  };
}
