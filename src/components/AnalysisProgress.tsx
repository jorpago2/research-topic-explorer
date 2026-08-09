import { Check } from "lucide-react";
import type { AnalysisPhase } from "../features/topic-ranking/service";

const phases: Array<{ id: AnalysisPhase; label: string }> = [
  { id: "resolving", label: "Resolving journals" },
  { id: "ranking", label: "Analyzing primary topics" },
  { id: "metadata", label: "Loading topic metadata" },
  { id: "preparing", label: "Preparing results" },
];

export function AnalysisProgress({ phase }: { phase: AnalysisPhase }) {
  const activeIndex = phases.findIndex((item) => item.id === phase);
  return (
    <section className="progress-panel" aria-live="polite" aria-label="Analysis progress">
      <div className="progress-heading">
        <strong>Running analysis</strong>
        <span>{activeIndex + 1} / {phases.length}</span>
      </div>
      <ol className="progress-steps">
        {phases.map((item, index) => (
          <li key={item.id} className={index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending"}>
            <span className="progress-indicator" aria-hidden="true">{index < activeIndex ? <Check size={14} /> : index + 1}</span>
            <span>{item.label}{index === activeIndex ? "…" : ""}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
