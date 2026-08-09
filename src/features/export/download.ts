import type { AnalysisResult, JournalResultRow, TrendPoint, VosviewerData } from "../../types/domain";
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
  return `${slugifyExportFilename(analysis.category.name)}-${analysis.year}`;
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
  }));
  downloadBlob(serializeCsv(data, Object.keys(data[0] ?? {})), "text/csv;charset=utf-8", `${analysisSlug(analysis)}-topic-trends.csv`);
}

export function downloadJournalsCsv(analysis: AnalysisResult, rows: JournalResultRow[]): void {
  const data = rows.map((row) => ({ source_id: row.sourceId, journal: row.journal, documents: row.documents, share: row.share }));
  downloadBlob(serializeCsv(data, Object.keys(data[0] ?? {})), "text/csv;charset=utf-8", `${analysisSlug(analysis)}-journals.csv`);
}

export function downloadVosviewerJson(analysis: AnalysisResult, data: VosviewerData): void {
  downloadBlob(JSON.stringify(data, null, 2), "application/json;charset=utf-8", `${analysisSlug(analysis)}-vosviewer-network.json`);
}
