import type { KeyboardEvent } from "react";
import type { ResultsTab } from "../types/domain";

const tabs: Array<{ id: ResultsTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "trends", label: "Trends" },
  { id: "network", label: "Network" },
  { id: "journals", label: "Journals" },
  { id: "methodology", label: "Methodology" },
];

export function ResultTabs({ active, onChange }: { active: ResultsTab; onChange: (tab: ResultsTab) => void }) {
  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const current = tabs.findIndex((tab) => tab.id === active);
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
    if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    onChange(tabs[next].id);
    requestAnimationFrame(() => document.getElementById(`tab-${tabs[next].id}`)?.focus({ preventScroll: true }));
  }
  return (
    <div className="tabs" role="tablist" aria-label="Analysis results">
      {tabs.map((tab) => (
        <button
          id={`tab-${tab.id}`}
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          aria-controls={`panel-${tab.id}`}
          tabIndex={active === tab.id ? 0 : -1}
          className={active === tab.id ? "active" : ""}
          onClick={() => onChange(tab.id)}
          onKeyDown={keyDown}
        >{tab.label}</button>
      ))}
    </div>
  );
}
