import type { Env } from "../types/env";
import { GROUPS_PER_PAGE, OPENALEX_OR_LIMIT, TOPIC_DETAILS_CONCURRENCY } from "./constants";
import { fetchOpenAlexJson, normalizeOpenAlexId } from "./client";

interface OpenAlexMeta {
  count?: number;
  next_cursor?: string | null;
  cost_usd?: number;
}

interface OpenAlexGroup {
  key: string | number;
  key_display_name: string | number | null;
  count: number;
}

interface OpenAlexGroupedResponse {
  meta?: OpenAlexMeta;
  group_by?: OpenAlexGroup[];
}

interface OpenAlexSource {
  id?: string;
  display_name?: string;
  issn_l?: string | null;
  issn?: string[] | null;
  type?: string | null;
}

interface OpenAlexSourceResponse {
  results?: OpenAlexSource[];
}

interface DehydratedEntity {
  id?: string;
  display_name?: string;
}

interface OpenAlexTopic {
  id?: string;
  display_name?: string;
  description?: string | null;
  keywords?: string[];
  subfield?: DehydratedEntity | null;
  field?: DehydratedEntity | null;
  domain?: DehydratedEntity | null;
}

export interface NormalizedGroupResponse {
  meta: { documentCount: number; nextCursor: string | null; costUsd?: number };
  groups: Array<{ id: string; displayName: string; count: number; topicId?: string; sourceId?: string; year?: number }>;
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

function buildWorksFilter(
  sourceIds: string[],
  yearOrRange: number | `${number}-${number}`,
  types: string[],
  extra?: string,
): string {
  const filters = [
    `publication_year:${yearOrRange}`,
    `primary_location.source.id:${sourceIds.join("|")}`,
  ];
  if (types.length) filters.push(`type:${types.join("|")}`);
  if (extra) filters.push(extra);
  return filters.join(",");
}

export async function resolveSources(env: Env, issns: string[]) {
  const byId = new Map<string, { id: string; displayName: string; issnL: string | null; issns: string[]; type: string | null }>();
  for (const batch of chunk(issns, OPENALEX_OR_LIMIT)) {
    const response = await fetchOpenAlexJson<OpenAlexSourceResponse>(env, "/sources", {
      filter: `issn:${batch.join("|")}`,
      per_page: "100",
      select: "id,display_name,issn_l,issn,type",
    });
    for (const source of response.results ?? []) {
      const id = normalizeOpenAlexId(source.id, "S");
      if (!id) continue;
      byId.set(id, {
        id,
        displayName: source.display_name || id,
        issnL: source.issn_l ?? null,
        issns: [...new Set(source.issn ?? [])].sort(),
        type: source.type ?? null,
      });
    }
  }
  const resolvedIssns = new Set([...byId.values()].flatMap((source) => [...source.issns, ...(source.issnL ? [source.issnL] : [])]));
  return { sources: [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName)), unresolvedIssns: issns.filter((issn) => !resolvedIssns.has(issn)) };
}

export async function groupWorks(
  env: Env,
  sourceIds: string[],
  yearOrRange: number | `${number}-${number}`,
  types: string[],
  groupBy: "primary_topic.id" | "publication_year" | "primary_location.source.id" | "topics.id",
  cursor: string,
  extraFilter?: string,
): Promise<NormalizedGroupResponse> {
  const response = await fetchOpenAlexJson<OpenAlexGroupedResponse>(env, "/works", {
    filter: buildWorksFilter(sourceIds, yearOrRange, types, extraFilter),
    group_by: groupBy,
    include_xpac: "false",
    per_page: String(GROUPS_PER_PAGE),
    cursor,
  });
  const groups = (response.group_by ?? []).map((group) => {
    const rawId = String(group.key);
    const topicId = normalizeOpenAlexId(rawId, "T");
    const sourceId = normalizeOpenAlexId(rawId, "S");
    const year = /^\d{4}$/.test(rawId) ? Number(rawId) : undefined;
    const id = topicId || sourceId || rawId;
    return {
      id,
      displayName: String(group.key_display_name ?? id),
      count: Number(group.count) || 0,
      ...(topicId ? { topicId } : {}),
      ...(sourceId ? { sourceId } : {}),
      ...(year ? { year } : {}),
    };
  });
  return {
    meta: {
      documentCount: Number(response.meta?.count) || 0,
      nextCursor: response.meta?.next_cursor ?? null,
      ...(typeof response.meta?.cost_usd === "number" ? { costUsd: response.meta.cost_usd } : {}),
    },
    groups,
  };
}

function normalizeEntity(value: DehydratedEntity | null | undefined): { id: string; displayName: string } | null {
  if (!value?.id || !value.display_name) return null;
  return { id: value.id.replace(/^https?:\/\/openalex\.org\//i, ""), displayName: value.display_name };
}

export async function getTopicDetails(env: Env, topicIds: string[]) {
  const topics = new Array<ReturnType<typeof normalizeTopic>>(topicIds.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < topicIds.length) {
      const index = nextIndex++;
      const topic = await fetchOpenAlexJson<OpenAlexTopic>(env, `/topics/${topicIds[index]}`, {});
      topics[index] = normalizeTopic(topic);
    }
  }
  await Promise.all(Array.from({ length: Math.min(TOPIC_DETAILS_CONCURRENCY, topicIds.length) }, () => worker()));
  return { topics: topics.filter((topic): topic is NonNullable<typeof topic> => Boolean(topic)) };
}

function normalizeTopic(topic: OpenAlexTopic) {
  const id = normalizeOpenAlexId(topic.id, "T");
  if (!id) return null;
  return {
    id,
    displayName: topic.display_name || id,
    description: topic.description ?? null,
    keywords: Array.isArray(topic.keywords) ? topic.keywords.filter((keyword): keyword is string => typeof keyword === "string").slice(0, 20) : [],
    subfield: normalizeEntity(topic.subfield),
    field: normalizeEntity(topic.field),
    domain: normalizeEntity(topic.domain),
  };
}
