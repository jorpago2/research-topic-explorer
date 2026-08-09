import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { chunkArray, mergeGroupedCounts } from "../../lib/analysis";
import { mapWithConcurrency } from "../../lib/concurrency";
import type {
  AnalysisResult,
  GroupRow,
  NetworkNormalization,
  TopicDetails,
  TopicEdge,
  TopicRankingRow,
  VosviewerData,
} from "../../types/domain";
import { CLIENT_SOURCE_CHUNK_SIZE, fetchAllGroupedPages, scopeRequestForAnalysis } from "../topic-ranking/service";

export const NETWORK_NODE_OPTIONS = [20, 30, 40] as const;
export const DEFAULT_NETWORK_NODES = 30;
export const MIN_EDGE_STRENGTH = 5;
export const MAX_NETWORK_EDGES = 250;
export const NETWORK_CONCURRENCY = 2;

export const NETWORK_NORMALIZATION_OPTIONS: Array<{ value: NetworkNormalization; label: string }> = [
  { value: "association-strength", label: "Association strength (VOS)" },
  { value: "cosine", label: "Cosine similarity" },
  { value: "jaccard", label: "Jaccard index" },
  { value: "raw", label: "Raw co-occurrence" },
];

interface LayoutNode extends SimulationNodeDatum {
  id: string;
}

interface LayoutLink extends SimulationLinkDatum<LayoutNode> {
  source: string | LayoutNode;
  target: string | LayoutNode;
  strength: number;
}

export interface NetworkProgress {
  completedSeeds: number;
  totalSeeds: number;
  status: "idle" | "loading" | "layout" | "ready" | "error";
}

export async function generateTopicNetwork(
  analysis: AnalysisResult,
  nodeCount: number,
  normalization: NetworkNormalization,
  onProgress: (progress: NetworkProgress) => void,
  signal?: AbortSignal,
): Promise<VosviewerData> {
  if (!NETWORK_NODE_OPTIONS.includes(nodeCount as (typeof NETWORK_NODE_OPTIONS)[number])) {
    throw new Error("Network node count must be 20, 30, or 40.");
  }
  const nodes = analysis.ranking.slice(0, nodeCount);
  if (nodes.length < 2) throw new Error("At least two ranked topics are required to build a network.");
  const sourceChunks = chunkArray(analysis.coverage.uniqueSources.map((source) => source.id).sort(), CLIENT_SOURCE_CHUNK_SIZE);
  const scopeRequest = scopeRequestForAnalysis(analysis);
  const seeds = nodes;
  let completedSeeds = 0;
  onProgress({ completedSeeds, totalSeeds: seeds.length, status: "loading" });

  const groupsBySeed = await mapWithConcurrency(seeds, NETWORK_CONCURRENCY, async (seed) => {
    const chunkGroups: GroupRow[][] = [];
    let occurrenceCount = 0;
    for (const sourceIds of sourceChunks) {
      if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
      const result = await fetchAllGroupedPages("/v1/group-topic-cooccurrence", {
        sourceIds,
        seedTopicId: seed.topicId,
        year: analysis.year,
        types: analysis.documentTypes,
        cursor: "*",
        ...scopeRequest,
      }, signal);
      chunkGroups.push(result.groups);
      occurrenceCount += result.documentCount;
    }
    completedSeeds += 1;
    onProgress({ completedSeeds, totalSeeds: seeds.length, status: "loading" });
    return [seed.topicId, { groups: mergeGroupedCounts(chunkGroups), occurrenceCount }] as const;
  });

  onProgress({ completedSeeds, totalSeeds: seeds.length, status: "layout" });
  const grouped = new Map(groupsBySeed.map(([topicId, value]) => [topicId, value.groups]));
  const occurrences = new Map(groupsBySeed.map(([topicId, value]) => [topicId, value.occurrenceCount]));
  const edges = buildTopicNetwork(nodes, grouped, occurrences, normalization, MIN_EDGE_STRENGTH, MAX_NETWORK_EDGES);
  const data = buildVosviewerJson(analysis, nodes, edges, normalization);
  onProgress({ completedSeeds, totalSeeds: seeds.length, status: "ready" });
  return data;
}

export function buildTopicNetwork(
  topics: TopicRankingRow[],
  groupsBySeed: Map<string, GroupRow[]>,
  occurrencesByTopic: Map<string, number>,
  normalization: NetworkNormalization,
  minimumStrength = MIN_EDGE_STRENGTH,
  maximumEdges = MAX_NETWORK_EDGES,
): TopicEdge[] {
  const indexById = new Map(topics.map((topic, index) => [topic.topicId, index]));
  const edges: TopicEdge[] = [];
  for (let sourceIndex = 0; sourceIndex < topics.length - 1; sourceIndex += 1) {
    const sourceId = topics[sourceIndex].topicId;
    for (const group of groupsBySeed.get(sourceId) ?? []) {
      const targetIndex = indexById.get(group.id);
      if (targetIndex == null || targetIndex <= sourceIndex || group.count < minimumStrength) continue;
      edges.push({
        sourceId,
        targetId: group.id,
        strength: normalizedStrength(group.count, occurrencesByTopic.get(sourceId) ?? 0, occurrencesByTopic.get(group.id) ?? 0, normalization),
        cooccurrences: group.count,
      });
    }
  }
  return edges
    .sort((a, b) => b.strength - a.strength || a.sourceId.localeCompare(b.sourceId) || a.targetId.localeCompare(b.targetId))
    .slice(0, maximumEdges);
}

export function buildVosviewerJson(
  analysis: Pick<AnalysisResult, "category" | "year" | "topicDetails" | "analysisScope">,
  topics: TopicRankingRow[],
  edges: TopicEdge[],
  normalization: NetworkNormalization,
  growthByTopic: Map<string, number | null> = new Map(),
): VosviewerData {
  const coordinates = deterministicLayout(topics, edges);
  const details = topics.map((topic) => analysis.topicDetails.get(topic.topicId));
  const subfields = [...new Map(details.filter(Boolean).map((detail) => [detail!.subfield?.id ?? "unclassified", detail!.subfield?.displayName ?? "Unclassified"])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));
  const clusterBySubfield = new Map(subfields.map(([id], index) => [id, index + 1]));

  return {
    network: {
      items: topics.map((topic) => {
        const detail = analysis.topicDetails.get(topic.topicId);
        const coordinate = coordinates.get(topic.topicId) ?? { x: 0, y: 0 };
        const growth = growthByTopic.get(topic.topicId);
        return {
          id: topic.topicId,
          label: topic.name,
          x: finite(coordinate.x),
          y: finite(coordinate.y),
          cluster: clusterBySubfield.get(detail?.subfield?.id ?? "unclassified") ?? 1,
          description: topicDescription(topic, detail, growth),
          weights: { Documents: topic.count },
          scores: {
            "Share (%)": topic.share * 100,
            ...(typeof growth === "number" && Number.isFinite(growth) ? { "Growth (%)": growth * 100 } : {}),
          },
        };
      }),
      links: edges.map((edge) => ({ source_id: edge.sourceId, target_id: edge.targetId, strength: edge.strength })),
      clusters: subfields.map(([, label], index) => ({ cluster: index + 1, label })),
    },
    info: {
      title: `${analysis.category.name} — OpenAlex topic network — ${analysis.year}`,
      description: `Topic co-occurrence network for ${analysis.analysisScope === "strict-subfield" ? "works whose primary topic belongs to the selected OpenAlex Subfield" : "all works in the selected journal set"}. Nodes use OpenAlex primary topics; links use all OpenAlex topics attached to matching works. Link normalization: ${normalizationLabel(normalization)}.`,
    },
  };
}

function topicDescription(topic: TopicRankingRow, detail: TopicDetails | undefined, growth: number | null | undefined): string {
  return [
    `Topic: ${topic.name}`,
    `Documents: ${topic.count}`,
    `Share: ${(topic.share * 100).toFixed(2)}%`,
    `Subfield: ${detail?.subfield?.displayName ?? "Not available"}`,
    `Field: ${detail?.field?.displayName ?? "Not available"}`,
    `Domain: ${detail?.domain?.displayName ?? "Not available"}`,
    `Selected-year growth: ${typeof growth === "number" ? `${(growth * 100).toFixed(1)}%` : "Not calculated"}`,
  ].join("\n");
}

function deterministicLayout(topics: TopicRankingRow[], edges: TopicEdge[]): Map<string, { x: number; y: number }> {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const nodes: LayoutNode[] = topics.map((topic, index) => ({
    id: topic.topicId,
    x: Math.cos(index * goldenAngle) * Math.sqrt(index + 1) * 12,
    y: Math.sin(index * goldenAngle) * Math.sqrt(index + 1) * 12,
  }));
  const maximumStrength = Math.max(...edges.map((edge) => edge.strength), 1e-12);
  const links: LayoutLink[] = edges.map((edge) => ({ source: edge.sourceId, target: edge.targetId, strength: edge.strength / maximumStrength }));
  const simulation = forceSimulation(nodes)
    .randomSource(seededRandom(0x5eed))
    .force("link", forceLink<LayoutNode, LayoutLink>(links).id((node) => node.id).distance(55).strength((link) => Math.min(0.9, 0.15 + link.strength * 0.75)))
    .force("charge", forceManyBody().strength(-85))
    .force("collision", forceCollide(14))
    .force("center", forceCenter(0, 0))
    .stop();
  for (let index = 0; index < 320; index += 1) simulation.tick();
  return new Map(nodes.map((node) => [node.id, { x: finite(node.x ?? 0), y: finite(node.y ?? 0) }]));
}

export function normalizedStrength(cooccurrences: number, sourceOccurrences: number, targetOccurrences: number, normalization: NetworkNormalization): number {
  if (cooccurrences <= 0 || sourceOccurrences <= 0 || targetOccurrences <= 0) return 0;
  let value: number;
  switch (normalization) {
    case "association-strength": value = cooccurrences / (sourceOccurrences * targetOccurrences); break;
    case "cosine": value = cooccurrences / Math.sqrt(sourceOccurrences * targetOccurrences); break;
    case "jaccard": value = cooccurrences / (sourceOccurrences + targetOccurrences - cooccurrences); break;
    case "raw": value = cooccurrences; break;
  }
  return Number.isFinite(value) ? Number(value.toPrecision(12)) : 0;
}

export function normalizationLabel(normalization: NetworkNormalization): string {
  return NETWORK_NORMALIZATION_OPTIONS.find((option) => option.value === normalization)?.label ?? normalization;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function finite(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(6)) : 0;
}
