import { Column, Grid, ProgressIndicator, ProgressStep, Tile } from "@carbon/react";
import type { AnalysisPhase } from "../features/topic-ranking/service";

const phases: Array<{ id: AnalysisPhase; label: string; description: string }> = [
  { id: "resolving", label: "Journal set", description: "Discovering OpenAlex Sources" },
  { id: "ranking", label: "Primary topics", description: "Grouping selected-year works" },
  { id: "metadata", label: "Topic metadata", description: "Loading hierarchy details" },
  { id: "preparing", label: "Results", description: "Preparing the workbench" },
];

export function AnalysisProgress({ phase }: { phase: AnalysisPhase }) {
  const activeIndex = Math.max(0, phases.findIndex((item) => item.id === phase));
  return (
    <Grid className="rte-progress-grid">
      <Column sm={4} md={8} lg={16}>
        <Tile>
          <h2 className="rte-section-title">Running analysis</h2>
          <ProgressIndicator currentIndex={activeIndex} spaceEqually>
            {phases.map((item, index) => <ProgressStep key={item.id} label={item.label} description={item.description} complete={index < activeIndex} current={index === activeIndex} />)}
          </ProgressIndicator>
        </Tile>
      </Column>
    </Grid>
  );
}
