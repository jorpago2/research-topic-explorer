import { describe, expect, it } from "vitest";
import { buildTopicNetwork, buildVosviewerJson } from "../src/features/network/service";
import type { TopicRankingRow } from "../src/types/domain";

const topics: TopicRankingRow[] = [
  { topicId: "T1", name: "One", count: 30, share: 0.3, rank: 1 },
  { topicId: "T2", name: "Two", count: 20, share: 0.2, rank: 2 },
  { topicId: "T3", name: "Three", count: 10, share: 0.1, rank: 3 },
];

describe("network construction", () => {
  it("removes self/reverse links, prunes weak links, and limits edges", () => {
    const edges = buildTopicNetwork(topics, new Map([
      ["T1", [{ id: "T1", displayName: "One", count: 30 }, { id: "T2", displayName: "Two", count: 12 }, { id: "T3", displayName: "Three", count: 3 }]],
      ["T2", [{ id: "T1", displayName: "One", count: 12 }, { id: "T3", displayName: "Three", count: 9 }]],
    ]), 5, 1);
    expect(edges).toEqual([{ sourceId: "T1", targetId: "T2", strength: 12 }]);
  });
  it("creates finite deterministic VOSviewer coordinates and valid IDs", () => {
    const analysis = {
      category: { schemaVersion: 1 as const, id: "sample", name: "Sample", taxonomy: "TEST", sourceNote: "Fixture", journals: [] },
      year: 2024,
      analysisScope: "journal-set" as const,
      topicDetails: new Map(),
    };
    const first = buildVosviewerJson(analysis, topics, [{ sourceId: "T1", targetId: "T2", strength: 12 }]);
    const second = buildVosviewerJson(analysis, topics, [{ sourceId: "T1", targetId: "T2", strength: 12 }]);
    expect(first).toEqual(second);
    expect(first.network.items.every((item) => /^T\d+$/.test(item.id) && Number.isFinite(item.x) && Number.isFinite(item.y))).toBe(true);
    expect(first.network.links[0]).toEqual({ source_id: "T1", target_id: "T2", strength: 12 });
  });
});
