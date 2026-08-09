import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalysisResult } from "../../types/domain";
import { downloadTrendsCsv } from "../export/download";
import { DEFAULT_TREND_TOPIC_COUNT, loadTrends, MAX_TREND_TOPICS } from "./service";

const chartColors = Array.from({ length: 12 }, (_, index) => `var(--chart-${index + 1})`);

export function TrendsTab({ analysis }: { analysis: AnalysisResult }) {
  const defaultStart = Math.max(1800, analysis.year - 4);
  const [startYear, setStartYear] = useState(defaultStart);
  const [metric, setMetric] = useState<"documents" | "share">("documents");
  const candidates = analysis.ranking.slice(0, MAX_TREND_TOPICS);
  const [selectedIds, setSelectedIds] = useState(() => candidates.slice(0, DEFAULT_TREND_TOPIC_COUNT).map((topic) => topic.topicId));
  const query = useQuery({
    queryKey: ["trends", analysis.category.id, analysis.year, analysis.documentTypeMode, analysis.coverage.uniqueSources.map((source) => source.id), startYear, selectedIds],
    queryFn: ({ signal }) => loadTrends(analysis, startYear, analysis.year, selectedIds, signal),
    enabled: selectedIds.length > 0,
  });
  const chartData = useMemo(() => {
    if (!query.data) return [];
    return Array.from({ length: analysis.year - startYear + 1 }, (_, index) => {
      const year = startYear + index;
      const row: Record<string, number> = { year };
      for (const point of query.data.filter((item) => item.year === year)) row[point.topicId] = metric === "documents" ? point.documents : point.share * 100;
      return row;
    });
  }, [query.data, analysis.year, startYear, metric]);
  const growth = useMemo(() => (query.data ?? [])
    .filter((point) => point.year === analysis.year && point.yoyGrowth !== null)
    .sort((a, b) => (b.yoyGrowth ?? 0) - (a.yoyGrowth ?? 0)), [query.data, analysis.year]);

  function toggleTopic(topicId: string) {
    setSelectedIds((current) => current.includes(topicId) ? current.filter((id) => id !== topicId) : current.length < MAX_TREND_TOPICS ? [...current, topicId] : current);
  }
  return (
    <div id="panel-trends" role="tabpanel" aria-labelledby="tab-trends" className="tab-panel">
      <section className="chart-section" aria-labelledby="trend-heading">
        <div className="section-heading-row">
          <div><h3 id="trend-heading">Topic trends</h3><p>Grouped publication counts; no individual works are downloaded.</p></div>
          {query.data ? <button type="button" className="secondary-button" onClick={() => downloadTrendsCsv(analysis, query.data!)}><Download size={16} /> Download CSV</button> : null}
        </div>
        <div className="trend-controls">
          <label className="field compact"><span className="field-label">Start year</span><select value={startYear} onChange={(event) => setStartYear(Number(event.target.value))}>{Array.from({ length: Math.min(15, analysis.year - 1799) }, (_, index) => analysis.year - 14 + index).filter((year) => year >= 1800).map((year) => <option key={year}>{year}</option>)}</select></label>
          <fieldset className="segmented-control"><legend>Metric</legend><label><input type="radio" name="trend-metric" checked={metric === "documents"} onChange={() => setMetric("documents")} /> Documents</label><label><input type="radio" name="trend-metric" checked={metric === "share"} onChange={() => setMetric("share")} /> Share of category</label></fieldset>
          <details className="topic-selector"><summary>{selectedIds.length} topics selected</summary><div>{candidates.map((topic) => <label key={topic.topicId}><input type="checkbox" checked={selectedIds.includes(topic.topicId)} onChange={() => toggleTopic(topic.topicId)} /> <span>{topic.name}</span></label>)}</div></details>
        </div>
        {query.isPending ? <div className="chart-loading" role="status">Loading grouped trend data…</div> : query.isError ? <div className="inline-error" role="alert">Trend data could not be loaded. {query.error.message}</div> : (
          <div className="trend-chart" aria-label="Topic trend chart">
            <ResponsiveContainer width="100%" height={480}>
              <LineChart data={chartData} margin={{ top: 12, right: 24, bottom: 8, left: 4 }}>
                <CartesianGrid stroke="var(--color-rule)" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: "var(--color-muted)", fontSize: 12 }} />
                <YAxis tick={{ fill: "var(--color-muted)", fontSize: 12 }} tickFormatter={(value) => metric === "share" ? `${value}%` : Number(value).toLocaleString()} />
                <Tooltip contentStyle={{ borderColor: "var(--color-rule)", borderRadius: "var(--radius-md)", background: "var(--color-paper-raised)" }} formatter={(value, name) => [metric === "share" ? `${Number(value).toFixed(2)}%` : Number(value).toLocaleString(), analysis.ranking.find((topic) => topic.topicId === name)?.name ?? name]} />
                <Legend formatter={(value) => analysis.ranking.find((topic) => topic.topicId === value)?.name ?? value} />
                {selectedIds.map((topicId, index) => <Line key={topicId} type="monotone" dataKey={topicId} stroke={chartColors[index]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
      {growth.length ? (
        <section className="data-section" aria-labelledby="growth-heading">
          <div className="section-heading-row"><div><h3 id="growth-heading">Fastest growing</h3><p>Topics with at least 20 documents in the previous year.</p></div></div>
          <div className="table-scroll"><table className="data-table"><thead><tr><th>Topic</th><th className="numeric">{analysis.year - 1}</th><th className="numeric">{analysis.year}</th><th className="numeric">Growth</th></tr></thead><tbody>{growth.map((point) => {
            const previous = query.data?.find((item) => item.topicId === point.topicId && item.year === analysis.year - 1)?.documents ?? 0;
            return <tr key={point.topicId}><td data-label="Topic">{point.topic}</td><td data-label={String(analysis.year - 1)} className="numeric">{previous.toLocaleString()}</td><td data-label={String(analysis.year)} className="numeric">{point.documents.toLocaleString()}</td><td data-label="Growth" className={`numeric growth ${point.yoyGrowth! >= 0 ? "positive" : "negative"}`}>{point.yoyGrowth! >= 0 ? "+" : ""}{(point.yoyGrowth! * 100).toFixed(1)}%</td></tr>;
          })}</tbody></table></div>
        </section>
      ) : null}
    </div>
  );
}
