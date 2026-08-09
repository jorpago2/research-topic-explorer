import type { AnalysisScope, DocumentTypeMode, NetworkNormalization, ResultsTab } from "../types/domain";

const tabs = new Set<ResultsTab>(["overview", "trends", "network", "journals", "methodology"]);
export const DEFAULT_SUBFIELD_ID = "2208";

export interface UrlState {
  categoryId: string;
  year: number;
  analysisScope: AnalysisScope;
  documentTypeMode: DocumentTypeMode;
  tab: ResultsTab;
  networkNodes: 20 | 30 | 40;
  networkNormalization: NetworkNormalization;
}

export function readUrlState(): UrlState {
  const params = new URLSearchParams(window.location.search);
  const parsedYear = Number(params.get("year"));
  const parsedNodes = Number(params.get("nodes"));
  const tab = params.get("tab") as ResultsTab;
  const scope = params.get("scope");
  return {
    categoryId: params.get("category") || DEFAULT_SUBFIELD_ID,
    year: Number.isInteger(parsedYear) && parsedYear >= 1800 && parsedYear <= new Date().getFullYear() ? parsedYear : new Date().getFullYear() - 1,
    analysisScope: scope === "strict" ? "strict-subfield" : scope === "journals" ? "journal-set" : params.has("category") ? "journal-set" : "strict-subfield",
    documentTypeMode: params.get("types") === "all" ? "all" : "article-review",
    tab: tabs.has(tab) ? tab : "overview",
    networkNodes: parsedNodes === 20 || parsedNodes === 40 ? parsedNodes : 30,
    networkNormalization: parseNetworkNormalization(params.get("normalization")),
  };
}

export function writeUrlState(state: UrlState): void {
  const params = new URLSearchParams();
  if (state.categoryId) params.set("category", state.categoryId);
  params.set("year", String(state.year));
  params.set("scope", state.analysisScope === "strict-subfield" ? "strict" : "journals");
  params.set("types", state.documentTypeMode === "all" ? "all" : "article,review");
  params.set("tab", state.tab);
  params.set("nodes", String(state.networkNodes));
  params.set("normalization", networkNormalizationParam(state.networkNormalization));
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
}

function parseNetworkNormalization(value: string | null): NetworkNormalization {
  if (value === "raw" || value === "cosine" || value === "jaccard") return value;
  return "association-strength";
}

function networkNormalizationParam(value: NetworkNormalization): string {
  return value === "association-strength" ? "association" : value;
}
