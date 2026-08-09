import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AppHeader } from "./components/AppHeader";
import { AnalysisForm } from "./components/AnalysisForm";
import { AnalysisProgress } from "./components/AnalysisProgress";
import { AnalysisSummary } from "./components/AnalysisSummary";
import { CoveragePanel } from "./components/CoveragePanel";
import { EmptyCatalog } from "./components/EmptyCatalog";
import { ErrorNotice } from "./components/ErrorNotice";
import { Footer } from "./components/Footer";
import { ResultTabs } from "./components/ResultTabs";
import { TopicDetailDialog } from "./components/TopicDetailDialog";
import { fetchCategory, fetchCategoryIndex } from "./features/categories/api";
import { JournalsTab } from "./features/journals/JournalsTab";
import { MethodologyTab } from "./features/methodology/MethodologyTab";
import { NetworkTab } from "./features/network/NetworkTab";
import { analyzeCategory, type AnalysisPhase } from "./features/topic-ranking/service";
import { OverviewTab } from "./features/topic-ranking/OverviewTab";
import { TrendsTab } from "./features/trends/TrendsTab";
import { apiRequest } from "./lib/api/client";
import { healthSchema } from "./lib/api/schemas";
import { readUrlState, writeUrlState } from "./lib/url-state";
import type { AnalysisResult, DocumentTypeMode, ResultsTab, TopicRankingRow } from "./types/domain";

export default function App() {
  const initial = useMemo(readUrlState, []);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [year, setYear] = useState(initial.year);
  const [documentTypeMode, setDocumentTypeMode] = useState<DocumentTypeMode>(initial.documentTypeMode);
  const [tab, setTab] = useState<ResultsTab>(initial.tab);
  const [networkNodes, setNetworkNodes] = useState<20 | 30 | 40>(initial.networkNodes);
  const [phase, setPhase] = useState<AnalysisPhase>("resolving");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicRankingRow | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const healthQuery = useQuery({ queryKey: ["health"], queryFn: ({ signal }) => apiRequest("/health", healthSchema, undefined, signal), retry: false, staleTime: 60_000 });
  const indexQuery = useQuery({ queryKey: ["category-index"], queryFn: ({ signal }) => fetchCategoryIndex(signal), staleTime: 30 * 60_000 });
  const selectedEntry = indexQuery.data?.categories.find((category) => category.id === categoryId);
  const categoryQuery = useQuery({
    queryKey: ["category", selectedEntry?.id, selectedEntry?.file],
    queryFn: ({ signal }) => fetchCategory(selectedEntry!.file, signal),
    enabled: Boolean(selectedEntry),
    staleTime: 30 * 60_000,
  });

  useEffect(() => {
    if (indexQuery.data?.categories.length && !indexQuery.data.categories.some((category) => category.id === categoryId)) {
      setCategoryId(indexQuery.data.categories[0].id);
    }
  }, [indexQuery.data, categoryId]);
  useEffect(() => {
    writeUrlState({ categoryId, year, documentTypeMode, tab, networkNodes });
  }, [categoryId, year, documentTypeMode, tab, networkNodes]);
  useEffect(() => () => controllerRef.current?.abort(), []);

  const analysisMutation = useMutation({
    mutationFn: async () => {
      if (!categoryQuery.data) throw new Error("The selected category has not finished loading.");
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      return analyzeCategory(categoryQuery.data, year, documentTypeMode, setPhase, controller.signal);
    },
    onSuccess: (result) => {
      setAnalysis(result);
      setTab("overview");
    },
  });

  function invalidateAnalysis() {
    controllerRef.current?.abort();
    analysisMutation.reset();
    setAnalysis(null);
    setSelectedTopic(null);
  }
  function changeCategory(value: string) { invalidateAnalysis(); setCategoryId(value); }
  function changeYear(value: number) { invalidateAnalysis(); setYear(value); }
  function changeTypes(value: DocumentTypeMode) { invalidateAnalysis(); setDocumentTypeMode(value); }
  function openMethodology() {
    if (analysis) setTab("methodology");
    requestAnimationFrame(() => document.getElementById(analysis ? "panel-methodology" : "methodology-note")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const mutationError = analysisMutation.error instanceof Error && analysisMutation.error.name !== "AbortError" ? analysisMutation.error.message : null;
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to analysis</a>
      <AppHeader onMethodology={openMethodology} serviceAvailable={healthQuery.isSuccess} />
      <main id="main-content" className={tab === "network" && analysis ? "app-main network-wide" : "app-main"}>
        <AnalysisForm
          categories={indexQuery.data?.categories ?? []}
          categoryId={categoryId}
          year={year}
          documentTypeMode={documentTypeMode}
          loading={analysisMutation.isPending}
          categoryReady={Boolean(categoryQuery.data)}
          onCategoryChange={changeCategory}
          onYearChange={changeYear}
          onDocumentTypeChange={changeTypes}
          onAnalyze={() => analysisMutation.mutate()}
        />

        {indexQuery.isPending ? <div className="catalog-loading" role="status">Loading category catalog…</div> : indexQuery.isError ? <ErrorNotice message="The production category catalog could not be loaded or validated." /> : indexQuery.data.categories.length === 0 ? <EmptyCatalog /> : null}
        {categoryQuery.isError ? <ErrorNotice message="The selected category file could not be loaded or validated." /> : null}
        {analysisMutation.isPending ? <AnalysisProgress phase={phase} /> : null}
        {mutationError ? <ErrorNotice message={mutationError} /> : null}

        {analysis ? (
          <div className="results-workbench" aria-busy={analysisMutation.isPending}>
            <AnalysisSummary analysis={analysis} />
            <CoveragePanel coverage={analysis.coverage} />
            <ResultTabs active={tab} onChange={setTab} />
            {tab === "overview" ? <OverviewTab analysis={analysis} onSelectTopic={setSelectedTopic} /> : null}
            {tab === "trends" ? <TrendsTab analysis={analysis} /> : null}
            {tab === "network" ? <NetworkTab key={`${analysis.metadata.generatedAt}-${networkNodes}`} analysis={analysis} nodeCount={networkNodes} onNodeCountChange={setNetworkNodes} /> : null}
            {tab === "journals" ? <JournalsTab analysis={analysis} /> : null}
            {tab === "methodology" ? <MethodologyTab analysis={analysis} fallbackMode={documentTypeMode} /> : null}
          </div>
        ) : (
          <section id="methodology-note" className="methodology-note">
            <strong>Methodology boundary</strong>
            <p>Category membership defines the journal set only. Publications and topic classifications come from OpenAlex; results are not Clarivate Citation Topics or official JCR analytics.</p>
          </section>
        )}
      </main>
      <TopicDetailDialog topic={selectedTopic} details={selectedTopic ? analysis?.topicDetails.get(selectedTopic.topicId) : undefined} onClose={() => setSelectedTopic(null)} />
      <Footer />
    </>
  );
}
