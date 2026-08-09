import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { downloadRankingCsv } from "../export/download";
import type { AnalysisResult, TopicRankingRow } from "../../types/domain";

const PAGE_SIZE = 25;

export function OverviewTab({ analysis, onSelectTopic }: { analysis: AnalysisResult; onSelectTopic: (topic: TopicRankingRow) => void }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? analysis.ranking.filter((topic) => topic.name.toLocaleLowerCase().includes(query) || topic.topicId.toLocaleLowerCase().includes(query)) : analysis.ranking;
  }, [analysis.ranking, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const topTopics = analysis.ranking.slice(0, 15).map((topic) => ({ ...topic, sharePercent: topic.share * 100 }));

  return (
    <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" className="tab-panel">
      {analysis.analyzedDocuments === 0 ? (
        <section className="empty-result"><h3>No matching documents</h3><p>No OpenAlex {analysis.documentTypes.length ? "articles or reviews" : "works"} were found for the resolved journals in {analysis.year}. Try all work types, another year, or inspect journal coverage.</p></section>
      ) : (
        <>
          <section className="chart-section" aria-labelledby="top-topics-title">
            <div className="section-heading-row">
              <div><h3 id="top-topics-title">Top primary topics</h3><p>Each analyzed work contributes to at most one primary-topic group.</p></div>
              <button type="button" className="secondary-button" onClick={() => downloadRankingCsv(analysis)}><Download size={16} /> Download CSV</button>
            </div>
            <div className="topic-chart" aria-hidden="true">
              <ResponsiveContainer width="100%" height={Math.max(420, topTopics.length * 32)}>
                <BarChart data={topTopics} layout="vertical" margin={{ top: 4, right: 28, bottom: 8, left: 8 }}>
                  <CartesianGrid stroke="var(--color-rule)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "var(--color-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={190} tick={{ fill: "var(--color-ink-soft)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "var(--color-paper-muted)" }} contentStyle={{ borderColor: "var(--color-rule)", borderRadius: "var(--radius-md)", background: "var(--color-paper-raised)" }} formatter={(value) => [Number(value).toLocaleString(), "Documents"]} />
                  <Bar dataKey="count" fill="var(--color-accent)" radius={[0, 3, 3, 0]} onClick={(entry) => {
                    const topic = analysis.ranking.find((item) => item.topicId === (entry as unknown as TopicRankingRow).topicId);
                    if (topic) onSelectTopic(topic);
                  }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="data-section" aria-labelledby="topic-table-title">
            <div className="section-heading-row table-tools">
              <div><h3 id="topic-table-title">All primary topics</h3><p>{filtered.length.toLocaleString()} topic{filtered.length === 1 ? "" : "s"}</p></div>
              <label className="search-field"><span className="sr-only">Search topics</span><Search size={17} aria-hidden="true" /><input type="search" value={search} placeholder="Topic name or ID" onChange={(event) => { setSearch(event.target.value); setPage(0); }} /></label>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Rank</th><th>Topic</th><th className="numeric">Documents</th><th className="numeric">Share</th><th>Subfield</th><th>Field</th></tr></thead>
                <tbody>
                  {rows.map((topic) => {
                    const details = analysis.topicDetails.get(topic.topicId);
                    return (
                      <tr key={topic.topicId}>
                        <td data-label="Rank" className="rank-cell">{topic.rank}</td>
                        <td data-label="Topic"><button type="button" className="topic-link" onClick={() => onSelectTopic(topic)}>{topic.name}<small>{topic.topicId}</small></button></td>
                        <td data-label="Documents" className="numeric">{topic.count.toLocaleString()}</td>
                        <td data-label="Share" className="numeric">{(topic.share * 100).toFixed(2)}%</td>
                        <td data-label="Subfield">{details?.subfield?.displayName ?? "—"}</td>
                        <td data-label="Field">{details?.field?.displayName ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pagination" aria-label="Topic table pagination">
              <button type="button" className="secondary-button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</button>
              <span>Page {page + 1} of {pageCount}</span>
              <button type="button" className="secondary-button" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>Next</button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
