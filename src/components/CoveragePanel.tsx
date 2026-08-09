import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { CoverageReport } from "../types/domain";

export function CoveragePanel({ coverage }: { coverage: CoverageReport }) {
  const incomplete = coverage.resolvedJournals < coverage.totalJournals;
  return (
    <details className={`coverage-panel ${incomplete ? "warning" : "complete"}`}>
      <summary>
        <span className="coverage-summary-icon" aria-hidden="true">{incomplete ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}</span>
        <span>
          <strong>OpenAlex journal set: {coverage.uniqueSources.length} Sources</strong>
          <small>{incomplete ? `Results exclude ${coverage.unresolvedJournals} unmatched journal(s).` : "Membership is derived from OpenAlex primary-topic work groups."}</small>
        </span>
        <span className="coverage-rate">{coverage.coveragePercentage.toFixed(1)}%</span>
      </summary>
      <div className="coverage-details">
        <table>
          <thead><tr><th>Journal</th><th>ISSNs</th><th>OpenAlex Sources</th><th>Status</th></tr></thead>
          <tbody>
            {coverage.rows.map((row) => (
              <tr key={`${row.journalName}-${row.inputIssns.join("-")}`}>
                <td data-label="Category journal">{row.journalName}</td>
                <td data-label="Input ISSNs"><code>{row.inputIssns.join(", ")}</code></td>
                <td data-label="OpenAlex Sources">{row.matchedSources.map((source) => source.displayName).join(", ") || "—"}</td>
                <td data-label="Status"><span className={`status-label ${row.resolved ? "resolved" : "unresolved"}`}>{row.resolved ? "Resolved" : "Unresolved"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
