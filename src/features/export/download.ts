import type { AnalysisResult, EmergingActorsResult, JournalResultRow, NetworkNormalization, PeriodComparisonResult, TopicImpactResult, TopicLifecycleSignal, TrendPoint, VosviewerData } from "../../types/domain";
import { slugifyExportFilename } from "../../lib/analysis";

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

export function serializeCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  return `\uFEFF${[columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\r\n")}`;
}

function downloadBlob(content: string, mimeType: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function analysisSlug(analysis: AnalysisResult): string {
  const scope = analysis.analysisScope === "strict-subfield" ? "strict-subfield" : "journal-set";
  return `${slugifyExportFilename(analysis.category.name)}-${analysis.year}-${scope}`;
}

function scopeColumns(analysis: AnalysisResult) {
  return {
    analysis_scope: analysis.analysisScope,
    scope_subfield_id: analysis.metadata.scopeSubfieldId ?? "",
  };
}

export function downloadRankingCsv(analysis: AnalysisResult): void {
  const rows = analysis.ranking.map((topic) => {
    const details = analysis.topicDetails.get(topic.topicId);
    return {
      rank: topic.rank,
      topic_id: topic.topicId,
      topic: topic.name,
      documents: topic.count,
      share: topic.share,
      subfield: details?.subfield?.displayName ?? "",
      field: details?.field?.displayName ?? "",
      domain: details?.domain?.displayName ?? "",
      category_id: analysis.category.id,
      category_name: analysis.category.name,
      category_taxonomy: analysis.category.taxonomy,
      category_edition: analysis.category.edition ?? "",
      publication_year: analysis.year,
      document_types: analysis.documentTypes.length ? analysis.documentTypes.join("|") : "all",
      ...scopeColumns(analysis),
    };
  });
  downloadBlob(serializeCsv(rows, Object.keys(rows[0] ?? {})), "text/csv;charset=utf-8", `${analysisSlug(analysis)}-topic-ranking.csv`);
}

export function downloadTrendsCsv(analysis: AnalysisResult, rows: TrendPoint[]): void {
  const data = rows.map((row) => ({
    topic_id: row.topicId,
    topic: row.topic,
    year: row.year,
    documents: row.documents,
    category_documents: row.categoryDocuments,
    share: row.share,
    yoy_growth: row.yoyGrowth,
    ...scopeColumns(analysis),
  }));
  downloadBlob(serializeCsv(data, Object.keys(data[0] ?? {})), "text/csv;charset=utf-8", `${analysisSlug(analysis)}-topic-trends.csv`);
}

export function downloadJournalsCsv(analysis: AnalysisResult, rows: JournalResultRow[]): void {
  const data = rows.map((row) => ({ source_id: row.sourceId, journal: row.journal, documents: row.documents, share: row.share, ...scopeColumns(analysis), jif: row.jif?.jif ?? "", jif_quartile: row.jif?.quartile ?? "", jif_edition: row.jif?.edition ?? "", jif_provider: row.jif?.provider ?? "" }));
  downloadBlob(serializeCsv(data, Object.keys(data[0] ?? {})), "text/csv;charset=utf-8", `${analysisSlug(analysis)}-journals.csv`);
}

export function downloadVosviewerJson(analysis: AnalysisResult, data: VosviewerData, normalization: NetworkNormalization): void {
  downloadBlob(JSON.stringify(data, null, 2), "application/json;charset=utf-8", `${analysisSlug(analysis)}-${normalization}-vosviewer-network.json`);
}

export function downloadPeriodComparisonCsv(analysis: AnalysisResult, comparison: PeriodComparisonResult): void {
  const data = comparison.rows.map((row) => ({
    topic_id: row.topicId,
    topic: row.topic,
    period_a: `${comparison.periodA.startYear}-${comparison.periodA.endYear}`,
    period_b: `${comparison.periodB.startYear}-${comparison.periodB.endYear}`,
    period_a_documents: row.periodACount,
    period_b_documents: row.periodBCount,
    period_a_annual_average: row.periodAAnnualAverage,
    period_b_annual_average: row.periodBAnnualAverage,
    period_a_share: row.periodAShare,
    period_b_share: row.periodBShare,
    annual_rate_change: row.annualRateChange ?? "",
    period_a_rank_within_selection: row.rankA,
    period_b_rank_within_selection: row.rankB,
    rank_change: row.rankChange,
    ...scopeColumns(analysis),
  }));
  downloadBlob(serializeCsv(data, Object.keys(data[0] ?? {})), "text/csv;charset=utf-8", `${analysisSlug(analysis)}-period-comparison.csv`);
}

export function downloadLifecycleCsv(analysis: AnalysisResult, rows: TopicLifecycleSignal[], comparison: PeriodComparisonResult): void {
  const data = rows.map((row) => ({
    topic_id: row.topicId,
    topic: row.topic,
    lifecycle_signal: row.status,
    period_a: `${comparison.periodA.startYear}-${comparison.periodA.endYear}`,
    period_b: `${comparison.periodB.startYear}-${comparison.periodB.endYear}`,
    period_a_documents: row.periodACount,
    period_b_documents: row.periodBCount,
    period_a_share: row.periodAShare,
    period_b_share: row.periodBShare,
    share_change: row.shareChange,
    recent_share_slope_per_year: row.recentShareSlope,
    share_acceleration: row.acceleration,
    ...scopeColumns(analysis),
  }));
  downloadBlob(serializeCsv(data, Object.keys(data[0] ?? {})), "text/csv;charset=utf-8", `${analysisSlug(analysis)}-topic-lifecycle.csv`);
}

export function downloadTopicImpactCsv(analysis: AnalysisResult, impact: TopicImpactResult): void {
  const data = impact.points.map((point) => ({
    topic_id: impact.topicId,
    topic: impact.topic,
    year: point.year,
    documents: point.documents,
    top_10_percent_documents: point.top10Documents,
    top_1_percent_documents: point.top1Documents,
    top_10_percent_rate: point.top10Rate,
    top_1_percent_rate: point.top1Rate,
    ...scopeColumns(analysis),
  }));
  downloadBlob(serializeCsv(data, Object.keys(data[0] ?? {})), "text/csv;charset=utf-8", `${analysisSlug(analysis)}-${impact.topicId.toLowerCase()}-normalized-impact.csv`);
}

export function downloadEmergingActorsCsv(analysis: AnalysisResult, actors: EmergingActorsResult): void {
  const data = ([
    ...actors.countries.map((row) => ({ dimension: "country", ...row })),
    ...actors.institutions.map((row) => ({ dimension: "institution", ...row })),
  ]).map((row) => ({
    topic_id: actors.topicId,
    topic: actors.topic,
    dimension: row.dimension,
    actor_id: row.id,
    actor: row.name,
    period_a: `${actors.periodA.startYear}-${actors.periodA.endYear}`,
    period_b: `${actors.periodB.startYear}-${actors.periodB.endYear}`,
    period_a_documents: row.periodACount,
    period_b_documents: row.periodBCount,
    document_gain: row.countChange,
    relative_change: row.relativeChange ?? "",
    period_a_rank: row.rankA,
    period_b_rank: row.rankB,
    rank_change: row.rankChange,
    ...scopeColumns(analysis),
  }));
  downloadBlob(serializeCsv(data, Object.keys(data[0] ?? {})), "text/csv;charset=utf-8", `${analysisSlug(analysis)}-${actors.topicId.toLowerCase()}-emerging-actors.csv`);
}
