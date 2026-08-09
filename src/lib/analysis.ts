import type {
  CategoryJournal,
  CoverageReport,
  GroupRow,
  JournalCoverageRow,
  ResolvedSource,
  TopicRankingRow,
} from "../types/domain";
import { normalizeIssn } from "./issn";

export function chunkArray<T>(values: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError("Chunk size must be a positive integer.");
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export function normalizeOpenAlexId(value: string, prefix: "S" | "T"): string | null {
  const candidate = value.trim().replace(/^https?:\/\/openalex\.org\//i, "").toUpperCase();
  return new RegExp(`^${prefix}\\d+$`).test(candidate) ? candidate : null;
}

export function mergeGroupedCounts(groups: readonly GroupRow[][]): GroupRow[] {
  const merged = new Map<string, GroupRow>();
  for (const page of groups) {
    for (const group of page) {
      const current = merged.get(group.id);
      merged.set(group.id, {
        id: group.id,
        displayName: current?.displayName || group.displayName,
        count: (current?.count ?? 0) + group.count,
      });
    }
  }
  return [...merged.values()].sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName));
}

export function calculateShare(count: number, denominator: number): number {
  if (!Number.isFinite(count) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return count / denominator;
}

export function calculateYoYGrowth(current: number, previous: number | null | undefined): number | null {
  if (previous == null || previous <= 0 || !Number.isFinite(current)) return null;
  return (current - previous) / previous;
}

export function buildTopicRanking(groups: GroupRow[], documentCount: number): TopicRankingRow[] {
  return groups
    .filter((group) => /^T\d+$/.test(group.id) && group.count > 0)
    .sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName))
    .map((group, index) => ({
      topicId: group.id,
      name: group.displayName,
      count: group.count,
      share: calculateShare(group.count, documentCount),
      rank: index + 1,
    }));
}

export function buildCoverageReport(
  journals: CategoryJournal[],
  sources: ResolvedSource[],
  unresolvedIssns: string[],
): CoverageReport {
  const sourceByIssn = new Map<string, ResolvedSource[]>();
  for (const source of sources) {
    for (const rawIssn of [...source.issns, ...(source.issnL ? [source.issnL] : [])]) {
      const issn = normalizeIssn(rawIssn, false);
      if (!issn) continue;
      const values = sourceByIssn.get(issn) ?? [];
      if (!values.some((candidate) => candidate.id === source.id)) values.push(source);
      sourceByIssn.set(issn, values);
    }
  }

  const rows: JournalCoverageRow[] = journals.map((journal) => {
    const inputIssns = journal.issns.map((issn) => normalizeIssn(issn, false)).filter((issn): issn is string => Boolean(issn));
    const matchedSources = [...new Map(inputIssns.flatMap((issn) => sourceByIssn.get(issn) ?? []).map((source) => [source.id, source])).values()];
    return { journalName: journal.name, inputIssns, matchedSources, resolved: matchedSources.length > 0 };
  });
  const uniqueSources = [...new Map(sources.map((source) => [source.id, source])).values()];
  const resolvedJournals = rows.filter((row) => row.resolved).length;
  return {
    totalJournals: rows.length,
    resolvedJournals,
    unresolvedJournals: rows.length - resolvedJournals,
    uniqueSources,
    coveragePercentage: calculateShare(resolvedJournals, rows.length) * 100,
    rows,
    unresolvedIssns,
  };
}

export function slugifyExportFilename(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "research-topic-explorer";
}
