import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Accordion, AccordionItem, Button, Checkbox, Column, Grid, InlineLoading, InlineNotification, RadioButton, RadioButtonGroup, Select, SelectItem, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tile } from "@carbon/react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalysisResult } from "../../types/domain";
import { downloadPeriodComparisonCsv, downloadTrendsCsv } from "../export/download";
import { buildPeriodComparison, COMPARISON_PERIOD_OPTIONS, DEFAULT_TREND_TOPIC_COUNT, loadTrends, MAX_TREND_TOPICS } from "./service";

const chartColors = Array.from({ length: 12 }, (_, index) => `var(--rte-chart-${index + 1})`);

export function TrendsTab({ analysis }: { analysis: AnalysisResult }) {
  const defaultStart = Math.max(1800, analysis.year - 4);
  const [startYear, setStartYear] = useState(defaultStart);
  const [metric, setMetric] = useState<"documents" | "share">("documents");
  const [comparisonYears, setComparisonYears] = useState<2 | 3 | 5>(3);
  const candidates = analysis.ranking.slice(0, MAX_TREND_TOPICS);
  const [selectedIds, setSelectedIds] = useState(() => candidates.slice(0, DEFAULT_TREND_TOPIC_COUNT).map((topic) => topic.topicId));
  const comparisonStartYear = analysis.year - comparisonYears * 2 + 1;
  const queryStartYear = Math.min(startYear, comparisonStartYear);
  const query = useQuery({
    queryKey: ["trends", analysis.category.id, analysis.year, analysis.documentTypeMode, analysis.analysisScope, analysis.coverage.uniqueSources.map((source) => source.id), queryStartYear, selectedIds],
    queryFn: ({ signal }) => loadTrends(analysis, queryStartYear, analysis.year, selectedIds, signal),
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
  const comparison = useMemo(() => query.data ? buildPeriodComparison(query.data, analysis.year, comparisonYears) : null, [query.data, analysis.year, comparisonYears]);

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
              <Column sm={4} md={4} lg={3}>
                <Select id="trend-start-year" labelText="Start year" value={String(startYear)} onChange={(event) => setStartYear(Number(event.target.value))}>
                  {Array.from({ length: Math.min(15, analysis.year - 1799) }, (_, index) => analysis.year - 14 + index).filter((candidateYear) => candidateYear >= 1800).map((candidateYear) => <SelectItem key={candidateYear} value={String(candidateYear)} text={String(candidateYear)} />)}
                </Select>
              </Column>
              <Column sm={4} md={4} lg={4}>
                <RadioButtonGroup name="trend-metric" legendText="Metric" orientation="horizontal" valueSelected={metric} onChange={(selection) => setMetric(selection as "documents" | "share")}>
                  <RadioButton id="metric-documents" value="documents" labelText="Documents" />
                  <RadioButton id="metric-share" value="share" labelText="Share of category" />
                </RadioButtonGroup>
              </Column>
              <Column sm={4} md={4} lg={3}>
                <Select id="comparison-years" labelText="Comparison periods" helperText="Two adjacent periods of equal length" value={String(comparisonYears)} onChange={(event) => setComparisonYears(Number(event.target.value) as 2 | 3 | 5)}>
                  {COMPARISON_PERIOD_OPTIONS.map((years) => <SelectItem key={years} value={String(years)} text={`${years} years each`} />)}
                </Select>
              </Column>
              <Column sm={4} md={4} lg={6}>
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
      {comparison ? (
        <Grid className="rte-panel-grid">
          <Column sm={4} md={8} lg={16}>
            <Tile className="rte-section-tile rte-table-tile">
              <div className="rte-section-heading">
                <div><h3 id="period-comparison-heading">Period comparison</h3><p>Annualized output and corpus share for the selected Topics. Rankings are calculated within this selection.</p></div>
                <Button kind="secondary" size="md" type="button" onClick={() => downloadPeriodComparisonCsv(analysis, comparison)}>Download comparison CSV</Button>
              </div>
              <div className="rte-table-scroll">
                <Table useZebraStyles size="lg" aria-label="Topic comparison between two periods">
                  <TableHead><TableRow><TableHeader>Topic</TableHeader><TableHeader>{comparison.periodA.startYear}–{comparison.periodA.endYear}<br />avg/year</TableHeader><TableHeader>{comparison.periodB.startYear}–{comparison.periodB.endYear}<br />avg/year</TableHeader><TableHeader>Annual-rate change</TableHeader><TableHeader>Share change</TableHeader><TableHeader>Rank change</TableHeader></TableRow></TableHead>
                  <TableBody>{comparison.rows.map((row) => <TableRow key={row.topicId}>
                    <TableCell>{row.topic}</TableCell>
                    <TableCell>{row.periodAAnnualAverage.toFixed(1)}</TableCell>
                    <TableCell>{row.periodBAnnualAverage.toFixed(1)}</TableCell>
                    <TableCell>{row.annualRateChange === null ? row.periodBAnnualAverage > 0 ? "New in selection" : "—" : `${row.annualRateChange >= 0 ? "+" : ""}${(row.annualRateChange * 100).toFixed(1)}%`}</TableCell>
                    <TableCell>{`${((row.periodBShare - row.periodAShare) * 100).toFixed(2)} pp`}</TableCell>
                    <TableCell>{row.rankChange === 0 ? "No change" : `${row.rankChange > 0 ? "+" : ""}${row.rankChange}`}</TableCell>
                  </TableRow>)}</TableBody>
                </Table>
              </div>
            </Tile>
          </Column>
        </Grid>
      ) : null}
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
