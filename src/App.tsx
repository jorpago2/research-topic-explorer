import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Column, Content, Grid, InlineLoading, InlineNotification, Tile } from "@carbon/react";
import { AnalysisForm } from "./components/AnalysisForm";
import { AnalysisProgress } from "./components/AnalysisProgress";
import { AnalysisSummary } from "./components/AnalysisSummary";
import { AppHeader } from "./components/AppHeader";
import { CoveragePanel } from "./components/CoveragePanel";
import { ErrorNotice } from "./components/ErrorNotice";
import { Footer } from "./components/Footer";
import { ResultTabs } from "./components/ResultTabs";
import { TopicDetailDialog } from "./components/TopicDetailDialog";
import { LocalJifLoader } from "./features/journal-metrics/LocalJifLoader";
import { parseLocalJifFile } from "./features/journal-metrics/local";
import { JournalsTab } from "./features/journals/JournalsTab";
import { MethodologyTab } from "./features/methodology/MethodologyTab";
import { NetworkTab } from "./features/network/NetworkTab";
import { OverviewTab } from "./features/topic-ranking/OverviewTab";
import { analyzeOpenAlexSubfield, applyJifDataset, type AnalysisPhase } from "./features/topic-ranking/service";
import { TrendsTab } from "./features/trends/TrendsTab";
import { apiRequest } from "./lib/api/client";
import { healthSchema, subfieldsSchema } from "./lib/api/schemas";
import { readUrlState, writeUrlState } from "./lib/url-state";
import type { AnalysisResult, DocumentTypeMode, JifDataset, ResultsTab, TopicRankingRow } from "./types/domain";

export default function App() {
  const initial = useMemo(readUrlState, []);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [year, setYear] = useState(initial.year);
  const [documentTypeMode, setDocumentTypeMode] = useState<DocumentTypeMode>(initial.documentTypeMode);
  const [tab, setTab] = useState<ResultsTab>(initial.tab);
  const [networkNodes, setNetworkNodes] = useState<20 | 30 | 40>(initial.networkNodes);
  const [phase, setPhase] = useState<AnalysisPhase>("resolving");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [jifDataset, setJifDataset] = useState<JifDataset | null>(null);
  const [jifFileName, setJifFileName] = useState<string | null>(null);
  const [jifLoading, setJifLoading] = useState(false);
  const [jifError, setJifError] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicRankingRow | null>(null);
  const [categoryWasCleared, setCategoryWasCleared] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const healthQuery = useQuery({ queryKey: ["health"], queryFn: ({ signal }) => apiRequest("/health", healthSchema, undefined, signal), retry: false, staleTime: 60_000 });
  const subfieldsQuery = useQuery({ queryKey: ["openalex-subfields"], queryFn: ({ signal }) => apiRequest("/v1/openalex-subfields", subfieldsSchema, {}, signal), staleTime: 24 * 60 * 60_000 });
  const selectedSubfield = subfieldsQuery.data?.subfields.find((subfield) => subfield.id === categoryId);

  useEffect(() => {
    if (subfieldsQuery.data?.subfields.length && !categoryWasCleared && !subfieldsQuery.data.subfields.some((subfield) => subfield.id === categoryId)) {
      const optics = subfieldsQuery.data.subfields.find((subfield) => subfield.displayName.toLocaleLowerCase().includes("optics"));
      setCategoryId(optics?.id ?? subfieldsQuery.data.subfields[0].id);
    }
  }, [subfieldsQuery.data, categoryId, categoryWasCleared]);
  useEffect(() => { writeUrlState({ categoryId, year, documentTypeMode, tab, networkNodes }); }, [categoryId, year, documentTypeMode, tab, networkNodes]);
  useEffect(() => () => controllerRef.current?.abort(), []);

  const analysisMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSubfield) throw new Error("The selected OpenAlex subfield has not finished loading.");
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      return analyzeOpenAlexSubfield(selectedSubfield, year, documentTypeMode, jifDataset, setPhase, controller.signal);
    },
    onSuccess: (result) => { setAnalysis(result); setTab("overview"); },
  });

  function invalidateAnalysis() {
    controllerRef.current?.abort();
    analysisMutation.reset();
    setAnalysis(null);
    setSelectedTopic(null);
  }
  function changeCategory(value: string) { invalidateAnalysis(); setCategoryWasCleared(!value); setCategoryId(value); }
  function changeYear(value: number) { invalidateAnalysis(); setYear(value); }
  function changeTypes(value: DocumentTypeMode) { invalidateAnalysis(); setDocumentTypeMode(value); }
  function openMethodology() {
    if (analysis) setTab("methodology");
    requestAnimationFrame(() => document.getElementById(analysis ? "panel-methodology" : "methodology-note")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  async function loadLocalJif(file: File) {
    setJifLoading(true);
    setJifError(null);
    try {
      const dataset = await parseLocalJifFile(file);
      setJifDataset(dataset);
      setJifFileName(file.name);
      setAnalysis((current) => current ? applyJifDataset(current, dataset) : current);
    } catch (error) {
      setJifError(error instanceof Error ? error.message : "The JIF file could not be validated.");
    } finally {
      setJifLoading(false);
    }
  }
  function clearLocalJif() {
    setJifDataset(null);
    setJifFileName(null);
    setJifError(null);
    setAnalysis((current) => current ? applyJifDataset(current, null) : current);
  }

  const mutationError = analysisMutation.error instanceof Error && analysisMutation.error.name !== "AbortError" ? analysisMutation.error.message : null;
  return (
    <>
      <AppHeader onMethodology={openMethodology} serviceAvailable={healthQuery.isSuccess} />
      <Content id="main-content" className="rte-content">
        <AnalysisForm subfields={subfieldsQuery.data?.subfields ?? []} categoryId={categoryId} year={year} documentTypeMode={documentTypeMode} loading={analysisMutation.isPending} categoryReady={Boolean(selectedSubfield)} onCategoryChange={changeCategory} onYearChange={changeYear} onDocumentTypeChange={changeTypes} onAnalyze={() => analysisMutation.mutate()} />
        <LocalJifLoader dataset={jifDataset} fileName={jifFileName} loading={jifLoading} disabled={jifLoading || analysisMutation.isPending} error={jifError} matchedSources={analysis ? analysis.jifBySourceId.size : null} totalSources={analysis ? analysis.coverage.uniqueSources.length : null} onFile={loadLocalJif} onClear={clearLocalJif} />

        {subfieldsQuery.isPending ? <Grid className="rte-notice-grid"><Column sm={4} md={8} lg={16}><Tile><InlineLoading description="Loading the OpenAlex taxonomy…" /></Tile></Column></Grid> : null}
        {subfieldsQuery.isError ? <Grid className="rte-notice-grid"><Column sm={4} md={8} lg={16}><InlineNotification kind="error" lowContrast hideCloseButton title="Taxonomy unavailable" subtitle="The OpenAlex subfield catalog could not be loaded or validated." /></Column></Grid> : null}
        {analysisMutation.isPending ? <AnalysisProgress phase={phase} /> : null}
        {mutationError ? <ErrorNotice message={mutationError} /> : null}

        {analysis ? (
          <section className="rte-results" aria-labelledby="result-heading" aria-busy={analysisMutation.isPending}>
            <AnalysisSummary analysis={analysis} />
            <CoveragePanel coverage={analysis.coverage} />
            <ResultTabs active={tab} onChange={setTab}>
              {tab === "overview" ? <OverviewTab analysis={analysis} onSelectTopic={setSelectedTopic} /> : null}
              {tab === "trends" ? <TrendsTab analysis={analysis} /> : null}
              {tab === "network" ? <NetworkTab key={`${analysis.metadata.generatedAt}-${networkNodes}`} analysis={analysis} nodeCount={networkNodes} onNodeCountChange={setNetworkNodes} /> : null}
              {tab === "journals" ? <JournalsTab analysis={analysis} /> : null}
              {tab === "methodology" ? <MethodologyTab analysis={analysis} fallbackMode={documentTypeMode} /> : null}
            </ResultTabs>
          </section>
        ) : (
          <Grid id="methodology-note" className="rte-methodology-note-grid">
            <Column sm={4} md={8} lg={12}>
              <Tile>
                <p className="rte-eyebrow">METHODOLOGY BOUNDARY</p>
                <h2>OpenAlex classification, separate JIF metadata</h2>
                <p>OpenAlex Subfields define the journal set by grouping articles and reviews on their primary-topic subfield and Source. Locally loaded JIF metadata does not affect classification or topic ranking.</p>
              </Tile>
            </Column>
          </Grid>
        )}
      </Content>
      <TopicDetailDialog topic={selectedTopic} details={selectedTopic ? analysis?.topicDetails.get(selectedTopic.topicId) : undefined} onClose={() => setSelectedTopic(null)} />
      <Footer />
    </>
  );
}
