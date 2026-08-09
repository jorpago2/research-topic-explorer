export type DocumentTypeMode = "article-review" | "all";
export type AnalysisScope = "journal-set" | "strict-subfield";
export type ResultsTab = "overview" | "trends" | "network" | "journals" | "methodology";

export interface CategoryIndexEntry {
  id: string;
  name: string;
  taxonomy: string;
  edition?: string;
  file: string;
}

export interface CategoryJournal {
  name: string;
  issns: string[];
}

export interface CategoryDefinition {
  schemaVersion: 1;
  id: string;
  name: string;
  taxonomy: string;
  edition?: string;
  sourceNote: string;
  journals: CategoryJournal[];
}

export interface ResolvedSource {
  id: string;
  displayName: string;
  issnL: string | null;
  issns: string[];
  type: string | null;
  worksCount?: number;
}

export interface OpenAlexSubfield {
  id: string;
  displayName: string;
  field: TopicHierarchyNode | null;
  domain: TopicHierarchyNode | null;
}

export interface JournalImpactMetric {
  journalName: string;
  eissn: string;
  index: string;
  citations: number | null;
  jif: number | null;
  previousJif: number | null;
  quartile: "Q1" | "Q2" | "Q3" | "Q4" | null;
  edition: string;
  provider: "Clarivate";
}

export interface JifDataset {
  schemaVersion: 1;
  provider: "Clarivate";
  metric: "Journal Impact Factor";
  edition: string;
  sourceNote: string;
  journals: JournalImpactMetric[];
}

export interface JournalCoverageRow {
  journalName: string;
  inputIssns: string[];
  matchedSources: ResolvedSource[];
  resolved: boolean;
}

export interface CoverageReport {
  totalJournals: number;
  resolvedJournals: number;
  unresolvedJournals: number;
  uniqueSources: ResolvedSource[];
  coveragePercentage: number;
  rows: JournalCoverageRow[];
  unresolvedIssns: string[];
}

export interface GroupRow {
  id: string;
  displayName: string;
  count: number;
}

export interface TopicRankingRow {
  topicId: string;
  name: string;
  count: number;
  share: number;
  rank: number;
}

export interface TopicHierarchyNode {
  id: string;
  displayName: string;
}

export interface TopicDetails {
  id: string;
  displayName: string;
  description: string | null;
  keywords: string[];
  subfield: TopicHierarchyNode | null;
  field: TopicHierarchyNode | null;
  domain: TopicHierarchyNode | null;
}

export interface TrendPoint {
  topicId: string;
  topic: string;
  year: number;
  documents: number;
  categoryDocuments: number;
  share: number;
  yoyGrowth: number | null;
}

export interface JournalResultRow {
  sourceId: string;
  journal: string;
  documents: number;
  share: number;
  jif?: JournalImpactMetric;
}

export interface TopicEdge {
  sourceId: string;
  targetId: string;
  strength: number;
}

export interface VosviewerItem {
  id: string;
  label: string;
  x: number;
  y: number;
  cluster: number;
  description?: string;
  weights: Record<string, number>;
  scores: Record<string, number>;
}

export interface VosviewerData {
  network: {
    items: VosviewerItem[];
    links: Array<{ source_id: string; target_id: string; strength: number }>;
    clusters: Array<{ cluster: number; label: string }>;
  };
  info: {
    title: string;
    description: string;
  };
}

export interface AnalysisMetadata {
  generatedAt: string;
  categoryId: string;
  categoryName: string;
  taxonomy: string;
  categoryEdition?: string;
  publicationYear: number;
  documentTypes: string[];
  totalInputJournals: number;
  resolvedJournals: number;
  resolvedSourceIds: string[];
  analyzedDocuments: number;
  classifiedDocuments: number;
  topicCountingMethod: "openalex-primary-topic";
  networkMethod: "openalex-topic-cooccurrence";
  includeXpac: false;
  analysisScope: AnalysisScope;
  scopeSubfieldId?: string;
  journalSetMethod?: "openalex-primary-subfield-source-groups";
  sourceSetTruncated?: boolean;
  jifEdition?: string;
}

export interface AnalysisResult {
  category: CategoryDefinition;
  year: number;
  analysisScope: AnalysisScope;
  documentTypeMode: DocumentTypeMode;
  documentTypes: string[];
  coverage: CoverageReport;
  ranking: TopicRankingRow[];
  topicDetails: Map<string, TopicDetails>;
  analyzedDocuments: number;
  classifiedDocuments: number;
  classificationCoverage: number;
  jifBySourceId: Map<string, JournalImpactMetric>;
  metadata: AnalysisMetadata;
}
