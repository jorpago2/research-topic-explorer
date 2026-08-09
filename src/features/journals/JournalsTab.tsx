import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Column, Grid, InlineLoading, InlineNotification, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tile } from "@carbon/react";
import type { AnalysisResult } from "../../types/domain";
import { downloadJournalsCsv } from "../export/download";
import { loadJournalBreakdown } from "./service";

export function JournalsTab({ analysis }: { analysis: AnalysisResult }) {
  const query = useQuery({ queryKey: ["journals", analysis.category.id, analysis.year, analysis.documentTypeMode, analysis.coverage.uniqueSources.map((source) => source.id)], queryFn: ({ signal }) => loadJournalBreakdown(analysis, signal) });
  const rows = useMemo(() => query.data?.map((row) => ({ ...row, ...(analysis.jifBySourceId.get(row.sourceId) ? { jif: analysis.jifBySourceId.get(row.sourceId) } : {}) })), [query.data, analysis.jifBySourceId]);
  return (
    <div id="panel-journals" className="rte-tab-panel">
      <Grid className="rte-panel-grid">
        <Column sm={4} md={8} lg={16}>
          <Tile className="rte-section-tile rte-table-tile">
            <div className="rte-section-heading">
              <div><h3 id="journals-heading">Journal breakdown</h3><p>Works use OpenAlex <code>primary_location.source</code>. Locally loaded JIF metadata is matched by eISSN.</p></div>
              {rows ? <Button kind="secondary" size="md" type="button" onClick={() => downloadJournalsCsv(analysis, rows)}>Download CSV</Button> : null}
            </div>
            {query.isPending ? <InlineLoading description="Loading journal groups…" /> : query.isError ? <InlineNotification kind="error" lowContrast hideCloseButton title="Journal data unavailable" subtitle={query.error.message} /> : (
              <div className="rte-table-scroll">
                <Table useZebraStyles size="lg" aria-label="Journal breakdown">
                  <TableHead><TableRow><TableHeader>Rank</TableHeader><TableHeader>Journal</TableHeader><TableHeader>OpenAlex Source</TableHeader><TableHeader>Documents</TableHeader><TableHeader>Share</TableHeader><TableHeader>JIF</TableHeader><TableHeader>Quartile</TableHeader></TableRow></TableHead>
                  <TableBody>{rows?.map((row, index) => <TableRow key={row.sourceId}><TableCell>{index + 1}</TableCell><TableCell data-label="Journal">{row.journal}</TableCell><TableCell><code>{row.sourceId}</code></TableCell><TableCell>{row.documents.toLocaleString()}</TableCell><TableCell>{(row.share * 100).toFixed(2)}%</TableCell><TableCell data-label="JIF">{row.jif?.jif?.toFixed(1) ?? "—"}</TableCell><TableCell>{row.jif?.quartile ?? "—"}</TableCell></TableRow>)}</TableBody>
                </Table>
              </div>
            )}
          </Tile>
        </Column>
      </Grid>
    </div>
  );
}
