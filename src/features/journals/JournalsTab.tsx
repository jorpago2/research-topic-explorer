import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import type { AnalysisResult } from "../../types/domain";
import { downloadJournalsCsv } from "../export/download";
import { loadJournalBreakdown } from "./service";

export function JournalsTab({ analysis }: { analysis: AnalysisResult }) {
  const query = useQuery({
    queryKey: ["journals", analysis.category.id, analysis.year, analysis.documentTypeMode, analysis.coverage.uniqueSources.map((source) => source.id)],
    queryFn: ({ signal }) => loadJournalBreakdown(analysis, signal),
  });
  return (
    <div id="panel-journals" role="tabpanel" aria-labelledby="tab-journals" className="tab-panel">
      <section className="data-section" aria-labelledby="journals-heading">
        <div className="section-heading-row">
          <div><h3 id="journals-heading">Journal breakdown</h3><p>Works are assigned using OpenAlex <code>primary_location.source</code>. JIF is owner-supplied Clarivate metadata matched by eISSN.</p></div>
          {query.data ? <button type="button" className="secondary-button" onClick={() => downloadJournalsCsv(analysis, query.data!)}><Download size={16} /> Download CSV</button> : null}
        </div>
        {query.isPending ? <div className="chart-loading" role="status">Loading journal groups…</div> : query.isError ? <div className="inline-error" role="alert">Journal data could not be loaded. {query.error.message}</div> : (
          <div className="table-scroll"><table className="data-table"><thead><tr><th>Rank</th><th>Journal</th><th>OpenAlex Source</th><th className="numeric">Documents</th><th className="numeric">Share</th><th className="numeric">JIF</th><th>Quartile</th></tr></thead><tbody>{query.data.map((row, index) => <tr key={row.sourceId}><td data-label="Rank">{index + 1}</td><td data-label="Journal">{row.journal}</td><td data-label="OpenAlex Source"><code>{row.sourceId}</code></td><td data-label="Documents" className="numeric">{row.documents.toLocaleString()}</td><td data-label="Share" className="numeric">{(row.share * 100).toFixed(2)}%</td><td data-label="JIF" className="numeric">{row.jif?.jif?.toFixed(1) ?? "—"}</td><td data-label="Quartile">{row.jif?.quartile ?? "—"}</td></tr>)}</tbody></table></div>
        )}
      </section>
    </div>
  );
}
