import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Accordion, AccordionItem, Button, Checkbox, Column, Grid, InlineLoading, InlineNotification, RadioButton, RadioButtonGroup, Select, SelectItem, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tile } from "@carbon/react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalysisResult } from "../../types/domain";
import { downloadTrendsCsv } from "../export/download";
import { DEFAULT_TREND_TOPIC_COUNT, loadTrends, MAX_TREND_TOPICS } from "./service";

const chartColors = Array.from({ length: 12 }, (_, index) => `var(--rte-chart-${index + 1})`);

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
      const selectedYear = startYear + index;
      const row: Record<string, number> = { year: selectedYear };
      for (const point of query.data.filter((item) => item.year === selectedYear)) row[point.topicId] = metric === "documents" ? point.documents : point.share * 100;
      return row;
    });
  }, [query.data, analysis.year, startYear, metric]);
  const growth = useMemo(() => (query.data ?? []).filter((point) => point.year === analysis.year && point.yoyGrowth !== null).sort((a, b) => (b.yoyGrowth ?? 0) - (a.yoyGrowth ?? 0)), [query.data, analysis.year]);

  function toggleTopic(topicId: string) {
    setSelectedIds((current) => current.includes(topicId) ? current.filter((id) => id !== topicId) : current.length < MAX_TREND_TOPICS ? [...current, topicId] : current);
  }
  return (
    <div id="panel-trends" className="rte-tab-panel">
      <Grid className="rte-panel-grid">
        <Column sm={4} md={8} lg={16}>
          <Tile className="rte-section-tile">
            <div className="rte-section-heading">
              <div><h3 id="trend-heading">Topic trends</h3><p>Grouped publication counts; no individual works are downloaded.</p></div>
              {query.data ? <Button kind="secondary" size="md" type="button" onClick={() => downloadTrendsCsv(analysis, query.data!)}>Download CSV</Button> : null}
            </div>
            <Grid narrow className="rte-control-grid">
              <Column sm={4} md={3} lg={4}>
                <Select id="trend-start-year" labelText="Start year" value={String(startYear)} onChange={(event) => setStartYear(Number(event.target.value))}>
                  {Array.from({ length: Math.min(15, analysis.year - 1799) }, (_, index) => analysis.year - 14 + index).filter((candidateYear) => candidateYear >= 1800).map((candidateYear) => <SelectItem key={candidateYear} value={String(candidateYear)} text={String(candidateYear)} />)}
                </Select>
              </Column>
              <Column sm={4} md={5} lg={6}>
                <RadioButtonGroup name="trend-metric" legendText="Metric" orientation="horizontal" valueSelected={metric} onChange={(selection) => setMetric(selection as "documents" | "share")}>
                  <RadioButton id="metric-documents" value="documents" labelText="Documents" />
                  <RadioButton id="metric-share" value="share" labelText="Share of category" />
                </RadioButtonGroup>
              </Column>
              <Column sm={4} md={8} lg={6}>
                <Accordion align="start">
                  <AccordionItem title={`${selectedIds.length} topics selected`}>
                    <div className="rte-checkbox-list">
                      {candidates.map((topic) => <Checkbox key={topic.topicId} id={`trend-${topic.topicId}`} labelText={topic.name} checked={selectedIds.includes(topic.topicId)} disabled={!selectedIds.includes(topic.topicId) && selectedIds.length >= MAX_TREND_TOPICS} onChange={() => toggleTopic(topic.topicId)} />)}
                    </div>
                  </AccordionItem>
                </Accordion>
              </Column>
            </Grid>
            {query.isPending ? <InlineLoading description="Loading grouped trend data…" /> : query.isError ? <InlineNotification kind="error" lowContrast hideCloseButton title="Trend data unavailable" subtitle={query.error.message} /> : (
              <div className="rte-trend-chart" aria-label="Topic trend chart">
                <ResponsiveContainer width="100%" height={480}>
                  <LineChart data={chartData} margin={{ top: 12, right: 24, bottom: 8, left: 4 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(value) => metric === "share" ? `${value}%` : Number(value).toLocaleString()} />
                    <Tooltip formatter={(value, name) => [metric === "share" ? `${Number(value).toFixed(2)}%` : Number(value).toLocaleString(), analysis.ranking.find((topic) => topic.topicId === name)?.name ?? name]} />
                    <Legend formatter={(value) => analysis.ranking.find((topic) => topic.topicId === value)?.name ?? value} />
                    {selectedIds.map((topicId, index) => <Line key={topicId} type="monotone" dataKey={topicId} stroke={chartColors[index]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />)}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Tile>
        </Column>
      </Grid>
      {growth.length ? (
        <Grid className="rte-panel-grid">
          <Column sm={4} md={8} lg={16}>
            <Tile className="rte-section-tile rte-table-tile">
              <div className="rte-section-heading"><div><h3 id="growth-heading">Fastest growing</h3><p>Topics with at least 20 documents in the previous year.</p></div></div>
              <div className="rte-table-scroll">
                <Table useZebraStyles size="lg" aria-label="Fastest growing topics">
                  <TableHead><TableRow><TableHeader>Topic</TableHeader><TableHeader>{analysis.year - 1}</TableHeader><TableHeader>{analysis.year}</TableHeader><TableHeader>Growth</TableHeader></TableRow></TableHead>
                  <TableBody>{growth.map((point) => {
                    const previous = query.data?.find((item) => item.topicId === point.topicId && item.year === analysis.year - 1)?.documents ?? 0;
                    return <TableRow key={point.topicId}><TableCell>{point.topic}</TableCell><TableCell>{previous.toLocaleString()}</TableCell><TableCell>{point.documents.toLocaleString()}</TableCell><TableCell>{point.yoyGrowth! >= 0 ? "+" : ""}{(point.yoyGrowth! * 100).toFixed(1)}%</TableCell></TableRow>;
                  })}</TableBody>
                </Table>
              </div>
            </Tile>
          </Column>
        </Grid>
      ) : null}
    </div>
  );
}
