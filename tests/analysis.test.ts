import { describe, expect, it } from "vitest";
import { buildCoverageReport, buildTopicRanking, calculateShare, calculateYoYGrowth, chunkArray, mergeGroupedCounts, normalizeOpenAlexId, slugifyExportFilename } from "../src/lib/analysis";
import { deduplicateIssns, normalizeIssn } from "../src/lib/issn";
import { buildPeriodComparison } from "../src/features/trends/service";
import type { TrendPoint } from "../src/types/domain";

describe("ISSN utilities", () => {
  it("normalizes valid ISSNs and preserves X check digits", () => {
    expect(normalizeIssn("10944087")).toBe("1094-4087");
    expect(normalizeIssn("2434-561X")).toBe("2434-561X");
  });
  it("reports checksum failures and deduplicates", () => {
    expect(normalizeIssn("1234-5678")).toBeNull();
    expect(deduplicateIssns(["1094-4087", "10944087", "invalid"])).toEqual({ valid: ["1094-4087"], invalid: ["invalid"] });
  });
});

describe("analysis utilities", () => {
  it("chunks 201 values using the OpenAlex OR limit", () => {
    expect(chunkArray(Array.from({ length: 201 }, (_, index) => index), 100).map((chunk) => chunk.length)).toEqual([100, 100, 1]);
  });
  it("merges grouped counts by ID", () => {
    expect(mergeGroupedCounts([
      [{ id: "T1", displayName: "One", count: 20 }, { id: "T2", displayName: "Two", count: 10 }],
      [{ id: "T1", displayName: "One", count: 15 }, { id: "T3", displayName: "Three", count: 5 }],
    ])).toEqual([
      { id: "T1", displayName: "One", count: 35 },
      { id: "T2", displayName: "Two", count: 10 },
      { id: "T3", displayName: "Three", count: 5 },
    ]);
  });
  it("calculates safe shares, growth, IDs, and ranking", () => {
    expect(calculateShare(25, 100)).toBe(0.25);
    expect(calculateShare(1, 0)).toBe(0);
    expect(calculateYoYGrowth(15, 10)).toBe(0.5);
    expect(calculateYoYGrowth(15, 0)).toBeNull();
    expect(normalizeOpenAlexId("https://openalex.org/S123", "S")).toBe("S123");
    expect(buildTopicRanking([{ id: "T1", displayName: "Topic", count: 25 }], 100)[0]).toMatchObject({ rank: 1, share: 0.25 });
    expect(slugifyExportFilename("Óptica integrada 2024")).toBe("optica-integrada-2024");
  });
  it("keeps unresolved journals visible in coverage", () => {
    const coverage = buildCoverageReport(
      [{ name: "Resolved", issns: ["1094-4087"] }, { name: "Unresolved", issns: ["0146-9592"] }],
      [{ id: "S1", displayName: "Resolved", issnL: "1094-4087", issns: ["1094-4087"], type: "journal" }],
      ["0146-9592"],
    );
    expect(coverage.resolvedJournals).toBe(1);
    expect(coverage.unresolvedJournals).toBe(1);
    expect(coverage.rows[1].resolved).toBe(false);
  });
  it("compares equal periods using annualized counts, shares, and selected-topic ranks", () => {
    const points: TrendPoint[] = [
      ...[2019, 2020, 2021, 2022, 2023, 2024].map((year, index) => ({ topicId: "T1", topic: "One", year, documents: 10 + index * 2, categoryDocuments: 100, share: (10 + index * 2) / 100, yoyGrowth: null })),
      ...[2019, 2020, 2021, 2022, 2023, 2024].map((year, index) => ({ topicId: "T2", topic: "Two", year, documents: 20 - index, categoryDocuments: 100, share: (20 - index) / 100, yoyGrowth: null })),
    ];
    const comparison = buildPeriodComparison(points, 2024, 3);
    expect(comparison.periodA).toEqual({ startYear: 2019, endYear: 2021 });
    expect(comparison.periodB).toEqual({ startYear: 2022, endYear: 2024 });
    expect(comparison.rows.find((row) => row.topicId === "T1")).toMatchObject({ periodAAnnualAverage: 12, periodBAnnualAverage: 18, annualRateChange: 0.5, rankA: 2, rankB: 1, rankChange: 1 });
  });
});
