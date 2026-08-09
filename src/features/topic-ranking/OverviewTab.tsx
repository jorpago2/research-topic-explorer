import { useEffect, useMemo, useState } from "react";
import { Button, Column, Grid, InlineNotification, Pagination, Search, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tile } from "@carbon/react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalysisResult, TopicRankingRow } from "../../types/domain";
import { downloadRankingCsv } from "../export/download";

const PAGE_SIZE = 25;

export function OverviewTab({ analysis, onSelectTopic }: { analysis: AnalysisResult; onSelectTopic: (topic: TopicRankingRow) => void }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const isNarrow = useMediaQuery("(max-width: 41.99rem)");
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? analysis.ranking.filter((topic) => topic.name.toLocaleLowerCase().includes(query) || topic.topicId.toLocaleLowerCase().includes(query)) : analysis.ranking;
  }, [analysis.ranking, search]);
  const rows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const topTopics = analysis.ranking.slice(0, isNarrow ? 10 : 15);
  const chartHeight = Math.max(isNarrow ? 520 : 420, topTopics.length * (isNarrow ? 52 : 32));

  return (
    <div id="panel-overview" className="rte-tab-panel">
      {analysis.analyzedDocuments === 0 ? (
        <Grid className="rte-panel-grid"><Column sm={4} md={8} lg={16}><InlineNotification kind="info" lowContrast hideCloseButton title="No matching documents" subtitle={`No OpenAlex ${analysis.documentTypes.length ? "articles or reviews" : "works"} were found for the resolved journals in ${analysis.year}. Try all work types, another year, or inspect journal coverage.`} /></Column></Grid>
      ) : (
        <>
          <Grid className="rte-panel-grid">
            <Column sm={4} md={8} lg={16}>
              <Tile className="rte-section-tile">
                <div className="rte-section-heading">
                  <div><h3 id="top-topics-title">Top primary topics</h3><p>Each analyzed work contributes to at most one primary-topic group.</p></div>
                  <Button kind="secondary" size="md" type="button" onClick={() => downloadRankingCsv(analysis)}>Download CSV</Button>
                </div>
                <div className="rte-topic-chart" aria-hidden="true">
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <BarChart data={topTopics} layout="vertical" margin={{ top: 4, right: isNarrow ? 8 : 28, bottom: 8, left: 0 }}>
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" width={isNarrow ? 128 : 190} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(value) => [Number(value).toLocaleString(), "Documents"]} />
                      <Bar dataKey="count" fill="var(--rte-chart-1)" isAnimationActive={false} onClick={(entry) => {
                        const topic = analysis.ranking.find((item) => item.topicId === (entry as unknown as TopicRankingRow).topicId);
                        if (topic) onSelectTopic(topic);
                      }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Tile>
            </Column>
          </Grid>
          <Grid className="rte-panel-grid">
            <Column sm={4} md={8} lg={16}>
              <Tile className="rte-section-tile rte-table-tile">
                <div className="rte-section-heading rte-table-heading">
                  <div><h3 id="topic-table-title">All primary topics</h3><p>{filtered.length.toLocaleString()} topic{filtered.length === 1 ? "" : "s"}</p></div>
                  <Search className="rte-topic-search" id="topic-search" labelText="Search topics" placeholder="Topic name or ID" size="lg" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} />
                </div>
                <div className="rte-table-scroll">
                  <Table useZebraStyles size="lg" aria-label="All primary topics">
                    <TableHead><TableRow><TableHeader>Rank</TableHeader><TableHeader>Topic</TableHeader><TableHeader>Documents</TableHeader><TableHeader>Share</TableHeader><TableHeader>Subfield</TableHeader><TableHeader>Field</TableHeader></TableRow></TableHead>
                    <TableBody>
                      {rows.map((topic) => {
                        const details = analysis.topicDetails.get(topic.topicId);
                        return (
                          <TableRow key={topic.topicId}>
                            <TableCell>{topic.rank}</TableCell>
                            <TableCell><Button kind="ghost" size="sm" type="button" className="rte-topic-button" onClick={() => onSelectTopic(topic)}>{topic.name} · {topic.topicId}</Button></TableCell>
                            <TableCell>{topic.count.toLocaleString()}</TableCell>
                            <TableCell>{(topic.share * 100).toFixed(2)}%</TableCell>
                            <TableCell>{details?.subfield?.displayName ?? "—"}</TableCell>
                            <TableCell>{details?.field?.displayName ?? "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <Pagination className="rte-topic-pagination" page={page + 1} pageSize={PAGE_SIZE} pageSizes={[PAGE_SIZE]} pageSizeInputDisabled totalItems={filtered.length} onChange={({ page: nextPage }) => setPage(nextPage - 1)} itemsPerPageText="Topics per page" />
              </Tile>
            </Column>
          </Grid>
        </>
      )}
    </div>
  );
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const update = () => setMatches(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, [query]);

  return matches;
}
