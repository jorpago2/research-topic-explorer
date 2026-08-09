import type { Env } from "../types/env";
import {
  GROUPS_PER_PAGE,
  MAX_SUBFIELD_TOPICS,
  OPENALEX_OR_LIMIT,
  SOURCE_DISCOVERY_PAGE_SIZE,
  TOPIC_DETAILS_CONCURRENCY,
} from "./constants";
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
  works_count?: number;
}

interface OpenAlexSourceResponse {
  meta?: OpenAlexMeta;
  results?: OpenAlexSource[];
}

interface OpenAlexSubfield {
  id?: string | number;
  display_name?: string;
  field?: DehydratedEntity | null;
  domain?: DehydratedEntity | null;
}

interface OpenAlexSubfieldResponse {
  meta?: OpenAlexMeta;
  results?: OpenAlexSubfield[];
}

interface OpenAlexTopicListResponse {
  meta?: OpenAlexMeta;
  results?: Array<{ id?: string }>;
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

function normalizeSubfieldId(value: unknown): string | null {
  const candidate = String(value ?? "").replace(/^https?:\/\/openalex\.org\/subfields\//i, "");
  return /^\d{1,8}$/.test(candidate) ? candidate : null;
}

export async function listSubfields(env: Env) {
  const subfields: Array<{
    id: string;
    displayName: string;
    field: { id: string; displayName: string } | null;
    domain: { id: string; displayName: string } | null;
  }> = [];
  let cursor = "*";
  for (let page = 0; page < 4; page += 1) {
    const response = await fetchOpenAlexJson<OpenAlexSubfieldResponse>(env, "/subfields", {
      per_page: "100",
      cursor,
      select: "id,display_name,field,domain",
    });
    for (const subfield of response.results ?? []) {
      const id = normalizeSubfieldId(subfield.id);
      if (!id || !subfield.display_name) continue;
      subfields.push({
        id,
        displayName: subfield.display_name,
        field: normalizeEntity(subfield.field),
        domain: normalizeEntity(subfield.domain),
      });
    }
    const nextCursor = response.meta?.next_cursor;
    if (!nextCursor) break;
    if (nextCursor === cursor) throw new Error("UPSTREAM_CURSOR_REPEATED");
    cursor = nextCursor;
  }
  return {
    subfields: [...new Map(subfields.map((subfield) => [subfield.id, subfield])).values()]
      .sort((a, b) => (a.domain?.displayName ?? "").localeCompare(b.domain?.displayName ?? "")
        || (a.field?.displayName ?? "").localeCompare(b.field?.displayName ?? "")
        || a.displayName.localeCompare(b.displayName)),
  };
}

export async function listSubfieldSources(env: Env, subfieldId: string, cursor: string) {
  const topicResponse = await fetchOpenAlexJson<OpenAlexTopicListResponse>(env, "/topics", {
    filter: `subfield.id:${subfieldId}`,
    per_page: String(MAX_SUBFIELD_TOPICS),
    cursor: "*",
    select: "id",
  });
  if (topicResponse.meta?.next_cursor) throw new Error("SUBFIELD_TOO_LARGE");
  const topicIds = [...new Set((topicResponse.results ?? [])
    .map((topic) => normalizeOpenAlexId(topic.id, "T"))
    .filter((id): id is string => Boolean(id)))];
  if (!topicIds.length) return { sources: [], nextCursor: null };

  const response = await fetchOpenAlexJson<OpenAlexSourceResponse>(env, "/sources", {
    filter: `type:journal,has_issn:true,topics.id:${topicIds.join("|")}`,
    sort: "-works_count",
    per_page: String(SOURCE_DISCOVERY_PAGE_SIZE),
    cursor,
    select: "id,display_name,issn_l,issn,type,works_count",
  });
  const sources = (response.results ?? []).flatMap((source) => {
    const id = normalizeOpenAlexId(source.id, "S");
    if (!id) return [];
    return [{
      id,
      displayName: source.display_name || id,
      issnL: source.issn_l ?? null,
      issns: [...new Set(source.issn ?? [])].sort(),
      type: source.type ?? null,
      worksCount: Number(source.works_count) || 0,
    }];
  });
  return { sources, nextCursor: response.meta?.next_cursor ?? null };
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
