import type { AnalysisScope, DocumentTypeMode, ResultsTab } from "../types/domain";

const tabs = new Set<ResultsTab>(["overview", "trends", "network", "journals", "methodology"]);

export interface UrlState {
  categoryId: string;
  year: number;
  analysisScope: AnalysisScope;
  documentTypeMode: DocumentTypeMode;
  tab: ResultsTab;
  networkNodes: 20 | 30 | 40;
}

export function readUrlState(): UrlState {
  const params = new URLSearchParams(window.location.search);
  const parsedYear = Number(params.get("year"));
  const parsedNodes = Number(params.get("nodes"));
  const tab = params.get("tab") as ResultsTab;
  const scope = params.get("scope");
  return {
    categoryId: params.get("category") || "",
    year: Number.isInteger(parsedYear) && parsedYear >= 1800 && parsedYear <= new Date().getFullYear() ? parsedYear : new Date().getFullYear() - 1,
    analysisScope: scope === "strict" ? "strict-subfield" : scope === "journals" ? "journal-set" : params.has("category") ? "journal-set" : "strict-subfield",
    documentTypeMode: params.get("types") === "all" ? "all" : "article-review",
    tab: tabs.has(tab) ? tab : "overview",
    networkNodes: parsedNodes === 20 || parsedNodes === 40 ? parsedNodes : 30,
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
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
}
