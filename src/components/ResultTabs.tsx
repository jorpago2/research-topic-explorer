import type { ReactNode } from "react";
import { Column, Grid, Tab, TabList, TabPanel, TabPanels, Tabs } from "@carbon/react";
import type { ResultsTab } from "../types/domain";

const tabs: Array<{ id: ResultsTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "trends", label: "Trends" },
  { id: "network", label: "Network" },
  { id: "journals", label: "Journals" },
  { id: "methodology", label: "Methodology" },
];

export function ResultTabs({ active, onChange, children }: { active: ResultsTab; onChange: (tab: ResultsTab) => void; children: ReactNode }) {
  const selectedIndex = Math.max(0, tabs.findIndex((item) => item.id === active));
  return (
    <Tabs selectedIndex={selectedIndex} onChange={({ selectedIndex: nextIndex }) => onChange(tabs[nextIndex].id)}>
      <Grid className="rte-tabs-grid">
        <Column sm={4} md={8} lg={16}>
          <TabList contained fullWidth activation="automatic" aria-label="Analysis results">
            {tabs.map((item) => <Tab id={`tab-${item.id}`} key={item.id}>{item.label}</Tab>)}
          </TabList>
        </Column>
      </Grid>
      <TabPanels>
        {tabs.map((item) => <TabPanel className="rte-carbon-tab-panel" key={item.id}>{item.id === active ? children : null}</TabPanel>)}
      </TabPanels>
    </Tabs>
  );
}
