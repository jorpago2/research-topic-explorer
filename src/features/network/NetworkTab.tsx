import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Download, Network as NetworkIcon, X } from "lucide-react";
import type { AnalysisResult, VosviewerData } from "../../types/domain";
import { downloadVosviewerJson } from "../export/download";
import { DEFAULT_NETWORK_NODES, generateTopicNetwork, NETWORK_NODE_OPTIONS, type NetworkProgress } from "./service";
import { VisualizationErrorBoundary } from "./VisualizationErrorBoundary";

const VosviewerNetwork = lazy(() => import("./VosviewerNetwork"));

export function NetworkTab({
  analysis,
  nodeCount = DEFAULT_NETWORK_NODES,
  onNodeCountChange,
}: {
  analysis: AnalysisResult;
  nodeCount?: 20 | 30 | 40;
  onNodeCountChange: (count: 20 | 30 | 40) => void;
}) {
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
      const network = await generateTopicNetwork(analysis, nodeCount, setProgress, controller.signal);
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

  const loading = progress.status === "loading" || progress.status === "layout";
  return (
    <div id="panel-network" role="tabpanel" aria-labelledby="tab-network" className="tab-panel network-panel">
      <section className="network-workbench" aria-labelledby="network-heading">
        <div className="section-heading-row">
          <div><h3 id="network-heading">Topic co-occurrence network</h3><p>Nodes are ranked primary topics. Links count works where both topics occur in the full OpenAlex topic array.</p></div>
          <div className="network-actions">
            {data ? <button type="button" className="secondary-button" onClick={() => downloadVosviewerJson(analysis, data)}><Download size={16} /> Download JSON</button> : null}
            {loading ? <button type="button" className="secondary-button" onClick={cancel}><X size={16} /> Cancel</button> : <button type="button" className="primary-button" onClick={generate} disabled={analysis.ranking.length < 2}><NetworkIcon size={16} /> {data ? "Regenerate" : "Generate network"}</button>}
          </div>
        </div>
        <div className="network-controls">
          <label className="field compact"><span className="field-label">Topics</span><select value={nodeCount} onChange={(event) => changeNodes(Number(event.target.value) as 20 | 30 | 40)} disabled={loading}>{NETWORK_NODE_OPTIONS.map((value) => <option key={value} value={value}>Top {value}</option>)}</select></label>
          <p>Weak links below 5 co-occurrences are removed; at most 250 links are rendered.</p>
        </div>
        {loading ? (
          <div className="network-progress" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <div><strong>{progress.status === "layout" ? "Calculating deterministic layout…" : `Querying topic relationships ${progress.completedSeeds} / ${progress.totalSeeds}`}</strong><p>The network is lazy-loaded because it uses more grouped queries than the ranking.</p></div>
          </div>
        ) : error ? <div className="inline-error" role="alert">The network could not be generated. {error}</div> : data ? (
          <div className="vosviewer-frame">
            <p className="mobile-network-note">The network is easier to explore on a larger display.</p>
            <VisualizationErrorBoundary>
              <Suspense fallback={<div className="network-progress" role="status"><span className="spinner" aria-hidden="true" /><strong>Loading VOSviewer Online…</strong></div>}>
                <VosviewerNetwork data={data} />
              </Suspense>
            </VisualizationErrorBoundary>
          </div>
        ) : (
          <div className="network-empty"><NetworkIcon size={28} aria-hidden="true" /><h4>Generate the relationship map when you need it</h4><p>Ranking and trend results remain available even if network generation is cancelled or rate-limited.</p></div>
        )}
      </section>
    </div>
  );
}
