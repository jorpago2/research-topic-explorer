import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Accordion, AccordionItem, Button, Checkbox, Column, Grid, InlineLoading, InlineNotification, RadioButton, RadioButtonGroup, Select, SelectItem, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tile } from "@carbon/react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ActorComparisonRow, AnalysisResult, TopicLifecycleStatus } from "../../types/domain";
import { downloadEmergingActorsCsv, downloadLifecycleCsv, downloadPeriodComparisonCsv, downloadTopicImpactCsv, downloadTrendsCsv } from "../export/download";
import { buildImpactSummary, buildLifecycleSignals, buildPeriodComparison, COMPARISON_PERIOD_OPTIONS, DEFAULT_TREND_TOPIC_COUNT, loadEmergingActors, loadTopicImpact, loadTrends, MAX_TREND_TOPICS } from "./service";

const chartColors = Array.from({ length: 12 }, (_, index) => `var(--rte-chart-${index + 1})`);

export function TrendsTab({ analysis }: { analysis: AnalysisResult }) {
  const defaultStart = Math.max(1800, analysis.year - 5);
  const [startYear, setStartYear] = useState(defaultStart);
  const [metric, setMetric] = useState<"documents" | "share">("documents");
  const [comparisonYears, setComparisonYears] = useState<2 | 3 | 5>(3);
  const candidates = analysis.ranking.slice(0, MAX_TREND_TOPICS);
  const [selectedIds, setSelectedIds] = useState(() => candidates.slice(0, DEFAULT_TREND_TOPIC_COUNT).map((topic) => topic.topicId));
  const [impactTopicId, setImpactTopicId] = useState(() => candidates[0]?.topicId ?? "");
  const [actorTopicId, setActorTopicId] = useState(() => candidates[0]?.topicId ?? "");
  const [actorRequestKey, setActorRequestKey] = useState<string | null>(null);
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
  const lifecycle = useMemo(() => query.data ? buildLifecycleSignals(query.data, analysis.year, comparisonYears) : [], [query.data, analysis.year, comparisonYears]);
  const impactQuery = useQuery({
    queryKey: ["topic-impact", analysis.category.id, analysis.year, analysis.documentTypeMode, analysis.analysisScope, analysis.coverage.uniqueSources.map((source) => source.id), queryStartYear, impactTopicId],
    queryFn: ({ signal }) => loadTopicImpact(analysis, queryStartYear, analysis.year, impactTopicId, query.data ?? [], signal),
    enabled: Boolean(query.data && impactTopicId),
  });
  const impactSummary = useMemo(() => impactQuery.data ? buildImpactSummary(impactQuery.data, analysis.year, comparisonYears) : null, [impactQuery.data, analysis.year, comparisonYears]);
  const impactChartData = useMemo(() => (impactQuery.data?.points ?? []).filter((point) => point.year >= startYear).map((point) => ({ year: point.year, top10: point.top10Rate * 100, top1: point.top1Rate * 100 })), [impactQuery.data, startYear]);
  const actorKey = `${actorTopicId}:${comparisonYears}:${analysis.year}`;
  const actorQuery = useQuery({
    queryKey: ["emerging-actors", analysis.category.id, analysis.year, analysis.documentTypeMode, analysis.analysisScope, analysis.coverage.uniqueSources.map((source) => source.id), actorKey],
    queryFn: ({ signal }) => {
      if (!comparison) throw new Error("Period comparison data is not ready.");
      return loadEmergingActors(analysis, actorTopicId, comparison.periodA, comparison.periodB, signal);
    },
    enabled: Boolean(comparison && actorTopicId && actorRequestKey === actorKey),
  });

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
      {lifecycle.length && comparison ? (
        <Grid className="rte-panel-grid">
          <Column sm={4} md={8} lg={16}>
            <Tile className="rte-section-tile rte-table-tile">
              <div className="rte-section-heading">
                <div><h3 id="lifecycle-heading">Topic lifecycle radar</h3><p>Signals use corpus share, recent slope, and acceleration across the two selected periods. At least 50 recent documents are required.</p></div>
                <Button kind="secondary" size="md" type="button" onClick={() => downloadLifecycleCsv(analysis, lifecycle, comparison)}>Download lifecycle CSV</Button>
              </div>
              <Grid narrow className="rte-signal-grid">
                {(["emerging", "growing", "mature", "declining"] as const).map((status) => <Column key={status} sm={4} md={2} lg={4}><Tile className="rte-signal-tile"><p>{lifecycleLabel(status)}</p><strong>{lifecycle.filter((row) => row.status === status).length}</strong></Tile></Column>)}
              </Grid>
              <div className="rte-table-scroll">
                <Table useZebraStyles size="lg" aria-label="Topic lifecycle signals" className="rte-lifecycle-table">
                  <TableHead><TableRow><TableHeader>Topic</TableHeader><TableHeader>Signal</TableHeader><TableHeader>{comparison.periodB.startYear}–{comparison.periodB.endYear}</TableHeader><TableHeader>Share change</TableHeader><TableHeader>Recent slope</TableHeader><TableHeader>Acceleration</TableHeader></TableRow></TableHead>
                  <TableBody>{lifecycle.map((row) => <TableRow key={row.topicId}><TableCell>{row.topic}</TableCell><TableCell><span className={`rte-signal-label rte-signal-${row.status}`}>{lifecycleLabel(row.status)}</span></TableCell><TableCell>{row.periodBCount.toLocaleString()}</TableCell><TableCell>{formatPercentagePointChange(row.shareChange)}</TableCell><TableCell>{formatSlope(row.recentShareSlope)}</TableCell><TableCell>{formatAcceleration(row.acceleration)}</TableCell></TableRow>)}</TableBody>
                </Table>
              </div>
            </Tile>
          </Column>
        </Grid>
      ) : null}
      {comparison ? (
        <Grid className="rte-panel-grid">
          <Column sm={4} md={8} lg={16}>
            <Tile className="rte-section-tile rte-table-tile">
              <div className="rte-section-heading">
                <div><h3 id="period-comparison-heading">Period comparison</h3><p>Annualized output and corpus share for the selected Topics. Rankings are calculated within this selection.</p></div>
                <Button kind="secondary" size="md" type="button" onClick={() => downloadPeriodComparisonCsv(analysis, comparison)}>Download comparison CSV</Button>
              </div>
              <div className="rte-table-scroll">
                <Table useZebraStyles size="lg" aria-label="Topic comparison between two periods" className="rte-comparison-table">
                  <TableHead><TableRow><TableHeader>Topic</TableHeader><TableHeader>{comparison.periodA.startYear}–{comparison.periodA.endYear}<br />avg/year</TableHeader><TableHeader>{comparison.periodB.startYear}–{comparison.periodB.endYear}<br />avg/year</TableHeader><TableHeader>Annual-rate change</TableHeader><TableHeader>Share change</TableHeader><TableHeader>Rank change</TableHeader></TableRow></TableHead>
                  <TableBody>{comparison.rows.map((row) => <TableRow key={row.topicId}>
                    <TableCell>{row.topic}</TableCell>
                    <TableCell>{row.periodAAnnualAverage.toFixed(1)}</TableCell>
                    <TableCell>{row.periodBAnnualAverage.toFixed(1)}</TableCell>
                    <TableCell>{formatAnnualRateChange(row.annualRateChange, row.periodBAnnualAverage)}</TableCell>
                    <TableCell>{formatPercentagePointChange(row.periodBShare - row.periodAShare)}</TableCell>
                    <TableCell>{row.rankChange === 0 ? "No change" : `${row.rankChange > 0 ? "+" : ""}${row.rankChange}`}</TableCell>
                  </TableRow>)}</TableBody>
                </Table>
              </div>
            </Tile>
          </Column>
        </Grid>
      ) : null}
      <Grid className="rte-panel-grid">
        <Column sm={4} md={8} lg={16}>
          <Tile className="rte-section-tile">
            <div className="rte-section-heading">
              <div><h3 id="impact-heading">Normalized citation impact</h3><p>Share of matching Topic works flagged by OpenAlex in the citation-normalized top 10% and top 1%.</p></div>
              {impactQuery.data ? <Button kind="secondary" size="md" type="button" onClick={() => downloadTopicImpactCsv(analysis, impactQuery.data!)}>Download impact CSV</Button> : null}
            </div>
            <Grid narrow className="rte-control-grid">
              <Column sm={4} md={4} lg={6}>
                <Select id="impact-topic" labelText="Impact Topic" value={impactTopicId} onChange={(event) => setImpactTopicId(event.target.value)} disabled={!candidates.length}>
                  {candidates.map((topic) => <SelectItem key={topic.topicId} value={topic.topicId} text={topic.name} />)}
                </Select>
              </Column>
              <Column sm={4} md={4} lg={10} className="rte-control-note"><p>Raw citation counts are not compared across publication years.</p></Column>
            </Grid>
            {impactQuery.isPending ? <div className="rte-loading-block"><InlineLoading description="Loading normalized impact…" /></div> : impactQuery.isError ? <div className="rte-notification-block"><InlineNotification kind="error" lowContrast hideCloseButton title="Impact data unavailable" subtitle={impactQuery.error.message} /></div> : impactQuery.data && impactSummary ? <>
              <Grid narrow className="rte-impact-grid">
                <Column sm={4} md={4} lg={5}><Tile className="rte-signal-tile"><p>Recent top 10%</p><strong>{formatPercent(impactSummary.top10RateB)}</strong><small>{formatPercentagePointChange(impactSummary.top10RateB - impactSummary.top10RateA)} vs prior period</small></Tile></Column>
                <Column sm={4} md={4} lg={5}><Tile className="rte-signal-tile"><p>Recent top 1%</p><strong>{formatPercent(impactSummary.top1RateB)}</strong><small>{formatPercentagePointChange(impactSummary.top1RateB - impactSummary.top1RateA)} vs prior period</small></Tile></Column>
                <Column sm={4} md={8} lg={6}><Tile className="rte-signal-tile"><p>Comparison window</p><strong>{impactSummary.periodA.startYear}–{impactSummary.periodB.endYear}</strong><small>Two periods of {comparisonYears} years</small></Tile></Column>
              </Grid>
              <div className="rte-trend-chart" aria-label="Normalized citation impact trend chart">
                <ResponsiveContainer width="100%" height={360}><LineChart data={impactChartData} margin={{ top: 12, right: 24, bottom: 8, left: 4 }}><CartesianGrid vertical={false} /><XAxis dataKey="year" /><YAxis tickFormatter={(value) => `${value}%`} /><Tooltip formatter={(value, name) => [`${Number(value).toFixed(2)}%`, name === "top10" ? "Top 10%" : "Top 1%"]} /><Legend formatter={(value) => value === "top10" ? "Top 10%" : "Top 1%"} /><Line type="monotone" dataKey="top10" stroke={chartColors[0]} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} /><Line type="monotone" dataKey="top1" stroke={chartColors[3]} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} /></LineChart></ResponsiveContainer>
              </div>
            </> : null}
          </Tile>
        </Column>
      </Grid>
      <Grid className="rte-panel-grid">
        <Column sm={4} md={8} lg={16}>
          <Tile className="rte-section-tile rte-table-tile">
            <div className="rte-section-heading">
              <div><h3 id="actors-heading">Emerging countries and institutions</h3><p>Largest positive output gains between the same two periods. Multi-country and multi-institution works can contribute to more than one actor.</p></div>
              {actorQuery.data ? <Button kind="secondary" size="md" type="button" onClick={() => downloadEmergingActorsCsv(analysis, actorQuery.data!)}>Download actors CSV</Button> : null}
            </div>
            <Grid narrow className="rte-control-grid">
              <Column sm={4} md={5} lg={8}><Select id="actor-topic" labelText="Topic for actor analysis" value={actorTopicId} onChange={(event) => { setActorTopicId(event.target.value); setActorRequestKey(null); }} disabled={!candidates.length}>{candidates.map((topic) => <SelectItem key={topic.topicId} value={topic.topicId} text={topic.name} />)}</Select></Column>
              <Column sm={4} md={3} lg={8} className="rte-form-action"><Button type="button" size="lg" onClick={() => {
                if (actorQuery.data && actorRequestKey === actorKey) void actorQuery.refetch();
                else setActorRequestKey(actorKey);
              }} disabled={!comparison || actorQuery.isFetching}>{actorQuery.isFetching ? "Analyzing actors…" : actorQuery.data && actorRequestKey === actorKey ? "Refresh actors" : "Analyze actors"}</Button></Column>
            </Grid>
            {actorQuery.isFetching ? <div className="rte-loading-block"><InlineLoading description="Comparing countries and institutions…" /></div> : actorQuery.isError ? <div className="rte-notification-block"><InlineNotification kind="error" lowContrast hideCloseButton title="Actor comparison unavailable" subtitle={actorQuery.error.message} /></div> : actorQuery.data ? <>
              {actorQuery.data.truncated ? <div className="rte-notification-block"><InlineNotification kind="info" lowContrast hideCloseButton title="Bounded actor comparison" subtitle="Each period uses the top 100 OpenAlex groups; lower-ranked actors are not included." /></div> : null}
              <Grid narrow className="rte-actor-grid">
                <Column sm={4} md={8} lg={8}><ActorTable title="Countries with largest gains" rows={actorQuery.data.countries} periodA={`${actorQuery.data.periodA.startYear}–${actorQuery.data.periodA.endYear}`} periodB={`${actorQuery.data.periodB.startYear}–${actorQuery.data.periodB.endYear}`} country /></Column>
                <Column sm={4} md={8} lg={8}><ActorTable title="Institutions with largest gains" rows={actorQuery.data.institutions} periodA={`${actorQuery.data.periodA.startYear}–${actorQuery.data.periodA.endYear}`} periodB={`${actorQuery.data.periodB.startYear}–${actorQuery.data.periodB.endYear}`} /></Column>
              </Grid>
            </> : <div className="rte-network-empty rte-actor-empty"><h4>Run this comparison when you need it</h4><p>The request is kept on demand because institutional grouping is more expensive than the core publication trend.</p></div>}
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

function ActorTable({ title, rows, periodA, periodB, country = false }: { title: string; rows: ActorComparisonRow[]; periodA: string; periodB: string; country?: boolean }) {
  return <section aria-label={title} className="rte-actor-section"><h4>{title}</h4>{rows.length ? <div className="rte-table-scroll"><Table useZebraStyles size="md" aria-label={title} className="rte-actor-table"><TableHead><TableRow><TableHeader>{country ? "Country" : "Institution"}</TableHeader><TableHeader>{periodA}</TableHeader><TableHeader>{periodB}</TableHeader><TableHeader>Gain</TableHeader><TableHeader>Growth</TableHeader><TableHeader>Rank Δ</TableHeader></TableRow></TableHead><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell>{country ? countryName(row.id, row.name) : row.name}</TableCell><TableCell>{row.periodACount.toLocaleString()}</TableCell><TableCell>{row.periodBCount.toLocaleString()}</TableCell><TableCell>+{row.countChange.toLocaleString()}</TableCell><TableCell>{row.relativeChange === null ? "New" : `+${(row.relativeChange * 100).toFixed(1)}%`}</TableCell><TableCell>{row.rankChange === 0 ? "—" : `${row.rankChange > 0 ? "+" : ""}${row.rankChange}`}</TableCell></TableRow>)}</TableBody></Table></div> : <p className="rte-empty-copy">No actors met the minimum recent-output and positive-gain thresholds.</p>}</section>;
}

function lifecycleLabel(status: TopicLifecycleStatus): string {
  return ({ emerging: "Emerging", growing: "Growing", mature: "Mature", declining: "Declining", insufficient: "Insufficient data" })[status];
}

function formatPercent(value: number): string { return `${(value * 100).toFixed(1)}%`; }

function formatSlope(value: number): string { return `${value > 0 ? "+" : ""}${(value * 100).toFixed(3)} pp/year`; }

function formatAcceleration(value: number): string { return `${value > 0 ? "+" : ""}${(value * 100).toFixed(3)} pp/year²`; }

function countryName(code: string, fallback: string): string {
  try { return new Intl.DisplayNames([navigator.language || "en"], { type: "region" }).of(code) ?? fallback; } catch { return fallback; }
}

function formatAnnualRateChange(change: number | null, recentAverage: number): string {
  if (change === null) return recentAverage > 0 ? "New in selection" : "—";
  const percentage = Math.abs(change * 100) < 0.05 ? 0 : change * 100;
  return `${percentage > 0 ? "+" : ""}${percentage.toFixed(1)}%`;
}

function formatPercentagePointChange(change: number): string {
  const points = Math.abs(change * 100) < 0.005 ? 0 : change * 100;
  return `${points > 0 ? "+" : ""}${points.toFixed(2)} pp`;
}
