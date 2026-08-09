import { Accordion, AccordionItem, Column, Grid, InlineNotification, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@carbon/react";
import type { CoverageReport } from "../types/domain";

export function CoveragePanel({ coverage }: { coverage: CoverageReport }) {
  const incomplete = coverage.resolvedJournals < coverage.totalJournals;
  return (
    <Grid className="rte-coverage-grid">
      <Column sm={4} md={8} lg={16}>
        <Accordion align="start" size="lg">
          <AccordionItem title={`OpenAlex journal set: ${coverage.uniqueSources.length} Sources · ${coverage.coveragePercentage.toFixed(1)}% coverage`}>
            {incomplete ? <InlineNotification kind="warning" lowContrast hideCloseButton title="Partial journal coverage" subtitle={`Results exclude ${coverage.unresolvedJournals} unmatched journal(s).`} /> : <p className="rte-secondary-text">Membership is derived from OpenAlex primary-topic work groups.</p>}
            <div className="rte-table-scroll">
              <Table useZebraStyles size="lg" aria-label="OpenAlex journal coverage details">
                <TableHead><TableRow><TableHeader>Journal</TableHeader><TableHeader>ISSNs</TableHeader><TableHeader>OpenAlex Sources</TableHeader><TableHeader>Status</TableHeader></TableRow></TableHead>
                <TableBody>
                  {coverage.rows.map((row) => (
                    <TableRow key={`${row.journalName}-${row.inputIssns.join("-")}`}>
                      <TableCell>{row.journalName}</TableCell>
                      <TableCell><code>{row.inputIssns.join(", ")}</code></TableCell>
                      <TableCell>{row.matchedSources.map((source) => source.displayName).join(", ") || "—"}</TableCell>
                      <TableCell>{row.resolved ? "Resolved" : "Unresolved"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </AccordionItem>
        </Accordion>
      </Column>
    </Grid>
  );
}
