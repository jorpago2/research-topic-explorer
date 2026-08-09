import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Button, Column, Grid, InlineLoading, InlineNotification, Select, SelectItem, Tile } from "@carbon/react";
import type { AnalysisResult, NetworkNormalization, VosviewerData } from "../../types/domain";
import { downloadVosviewerJson } from "../export/download";
import { DEFAULT_NETWORK_NODES, generateTopicNetwork, NETWORK_NODE_OPTIONS, NETWORK_NORMALIZATION_OPTIONS, normalizationLabel, type NetworkProgress } from "./service";
import { VisualizationErrorBoundary } from "./VisualizationErrorBoundary";

const VosviewerNetwork = lazy(() => import("./VosviewerNetwork"));

interface NetworkTabProps {
  analysis: AnalysisResult;
  nodeCount?: 20 | 30 | 40;
  normalization: NetworkNormalization;
  onNodeCountChange: (count: 20 | 30 | 40) => void;
  onNormalizationChange: (normalization: NetworkNormalization) => void;
}

export function NetworkTab({ analysis, nodeCount = DEFAULT_NETWORK_NODES, normalization, onNodeCountChange, onNormalizationChange }: NetworkTabProps) {
  const [data, setData] = useState<VosviewerData | null>(null);
  const [progress, setProgress] = useState<NetworkProgress>({ completedSeeds: 0, totalSeeds: 0, status: "idle" });
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => controllerRef.current?.abort(), []);

  async function generate() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setData(null);
    try {
      const network = await generateTopicNetwork(analysis, nodeCount, normalization, setProgress, controller.signal);
      setData(network);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") {
        setProgress((current) => ({ ...current, status: "idle" }));
        return;
      }
      setProgress((current) => ({ ...current, status: "error" }));
      setError(cause instanceof Error ? cause.message : "The network could not be generated.");
    }
  }
  function cancel() {
    controllerRef.current?.abort();
    setProgress((current) => ({ ...current, status: "idle" }));
  }
  function changeNodes(value: 20 | 30 | 40) {
    cancel();
    setData(null);
    setError(null);
    onNodeCountChange(value);
  }
  function changeNormalization(value: NetworkNormalization) {
    cancel();
    setData(null);
    setError(null);
    onNormalizationChange(value);
  }

  const loading = progress.status === "loading" || progress.status === "layout";
  return (
    <div id="panel-network" className="rte-tab-panel">
      <Grid className="rte-panel-grid">
        <Column sm={4} md={8} lg={16}>
          <Tile className="rte-section-tile">
            <div className="rte-section-heading">
              <div><h3 id="network-heading">Topic co-occurrence network</h3><p>Nodes are ranked primary topics. Links connect topics found in the same works; the selected normalization controls their strength.</p></div>
              <div className="rte-button-group">
                {data ? <Button kind="secondary" size="md" type="button" onClick={() => downloadVosviewerJson(analysis, data, normalization)}>Download JSON</Button> : null}
                {loading ? <Button kind="tertiary" size="md" type="button" onClick={cancel}>Cancel</Button> : <Button size="md" type="button" onClick={generate} disabled={analysis.ranking.length < 2}>{data ? "Regenerate" : "Generate network"}</Button>}
              </div>
            </div>
            <Grid narrow className="rte-control-grid">
              <Column sm={4} md={3} lg={4}>
                <Select id="network-topics" labelText="Topics" value={String(nodeCount)} onChange={(event) => changeNodes(Number(event.target.value) as 20 | 30 | 40)} disabled={loading}>
                  {NETWORK_NODE_OPTIONS.map((value) => <SelectItem key={value} value={String(value)} text={`Top ${value}`} />)}
                </Select>
              </Column>
              <Column sm={4} md={5} lg={5}>
                <Select id="network-normalization" labelText="Link normalization" helperText="Controls link strength, not which works are included" value={normalization} onChange={(event) => changeNormalization(event.target.value as NetworkNormalization)} disabled={loading}>
                  {NETWORK_NORMALIZATION_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value} text={option.label} />)}
                </Select>
              </Column>
              <Column sm={4} md={8} lg={7} className="rte-control-note"><p>Links require at least 5 shared works. Current weighting: {normalizationLabel(normalization)}.</p></Column>
            </Grid>
            {loading ? <InlineLoading description={progress.status === "layout" ? "Calculating deterministic layout…" : `Querying topic relationships ${progress.completedSeeds} / ${progress.totalSeeds}`} /> : error ? <InlineNotification kind="error" lowContrast hideCloseButton title="Network generation failed" subtitle={error} /> : data ? (
              <div className="vosviewer-frame">
                <p className="rte-mobile-network-note">The network is easier to explore on a larger display.</p>
                <VisualizationErrorBoundary>
                  <Suspense fallback={<InlineLoading description="Loading VOSviewer Online…" />}><VosviewerNetwork data={data} /></Suspense>
                </VisualizationErrorBoundary>
              </div>
            ) : (
              <div className="rte-network-empty"><h4>Generate the relationship map when you need it</h4><p>Ranking and trend results remain available if network generation is cancelled or rate-limited.</p></div>
            )}
          </Tile>
        </Column>
      </Grid>
    </div>
  );
}
