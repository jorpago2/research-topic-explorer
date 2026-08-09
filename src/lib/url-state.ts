import type { DocumentTypeMode, ResultsTab } from "../types/domain";

const tabs = new Set<ResultsTab>(["overview", "trends", "network", "journals", "methodology"]);

export interface UrlState {
  categoryId: string;
  year: number;
  documentTypeMode: DocumentTypeMode;
  tab: ResultsTab;
  networkNodes: 20 | 30 | 40;
}

export function readUrlState(): UrlState {
  const params = new URLSearchParams(window.location.search);
  const parsedYear = Number(params.get("year"));
  const parsedNodes = Number(params.get("nodes"));
  const tab = params.get("tab") as ResultsTab;
  return {
    categoryId: params.get("category") || "",
    year: Number.isInteger(parsedYear) && parsedYear >= 1800 && parsedYear <= new Date().getFullYear() ? parsedYear : new Date().getFullYear() - 1,
    documentTypeMode: params.get("types") === "all" ? "all" : "article-review",
    tab: tabs.has(tab) ? tab : "overview",
    networkNodes: parsedNodes === 20 || parsedNodes === 40 ? parsedNodes : 30,
  };
}

export function writeUrlState(state: UrlState): void {
  const params = new URLSearchParams();
  if (state.categoryId) params.set("category", state.categoryId);
  params.set("year", String(state.year));
  params.set("types", state.documentTypeMode === "all" ? "all" : "article,review");
  params.set("tab", state.tab);
  params.set("nodes", String(state.networkNodes));
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
}
