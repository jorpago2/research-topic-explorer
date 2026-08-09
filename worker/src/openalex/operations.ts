import type { Env } from "../types/env";
import {
  GROUPS_PER_PAGE,
  OPENALEX_OR_LIMIT,
  SOURCE_DISCOVERY_LIMIT,
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

interface OpenAlexTopicAssignment extends DehydratedEntity {
  score?: number;
}

interface OpenAlexWork {
  id?: string;
  display_name?: string;
  doi?: string | null;
  publication_year?: number;
  publication_date?: string;
  cited_by_count?: number;
  primary_location?: { source?: OpenAlexSource | null } | null;
  primary_topic?: OpenAlexTopicAssignment | null;
  topics?: OpenAlexTopicAssignment[] | null;
}

interface OpenAlexWorkResponse {
  meta?: OpenAlexMeta;
  results?: OpenAlexWork[];
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

export async function getTopicEvidence(
  env: Env,
  sourceIds: string[],
  topicId: string,
  year: number,
  types: string[],
  limit: number,
  subfieldId?: string,
) {
  const extraFilters = [`primary_topic.id:${topicId}`];
  if (subfieldId) extraFilters.push(`primary_topic.subfield.id:${subfieldId}`);
  const response = await fetchOpenAlexJson<OpenAlexWorkResponse>(env, "/works", {
    filter: buildWorksFilter(sourceIds, year, types, extraFilters.join(",")),
    include_xpac: "false",
    sort: "cited_by_count:desc",
    per_page: String(limit),
    select: "id,display_name,doi,publication_year,publication_date,cited_by_count,primary_location,primary_topic,topics",
  });
  return {
    selectionMethod: "most-cited-primary-topic-matches" as const,
    works: (response.results ?? []).flatMap((work) => {
      const id = typeof work.id === "string" ? work.id.replace(/^https?:\/\/openalex\.org\//i, "") : "";
      const title = plainTextTitle(work.display_name ?? "");
      if (!/^W\d+$/.test(id) || !title) return [];
      const sourceId = normalizeOpenAlexId(work.primary_location?.source?.id, "S");
      return [{
        id,
        title,
        doi: typeof work.doi === "string" && /^https:\/\/doi\.org\//i.test(work.doi) ? work.doi : null,
        publicationYear: Number(work.publication_year) || year,
        publicationDate: /^\d{4}-\d{2}-\d{2}$/.test(work.publication_date ?? "") ? work.publication_date! : null,
        citedByCount: Math.max(0, Number(work.cited_by_count) || 0),
        source: sourceId ? { id: sourceId, displayName: work.primary_location?.source?.display_name || sourceId } : null,
        primaryTopic: normalizeTopicAssignment(work.primary_topic),
        topics: (work.topics ?? []).flatMap((topic) => {
          const normalized = normalizeTopicAssignment(topic);
          return normalized ? [normalized] : [];
        }).slice(0, 3),
      }];
    }),
  };
}

function normalizeTopicAssignment(topic: OpenAlexTopicAssignment | null | undefined) {
  const id = normalizeOpenAlexId(topic?.id, "T");
  if (!id) return null;
  const score = Number(topic?.score);
  return {
    id,
    displayName: topic?.display_name || id,
    score: Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : null,
  };
}

function plainTextTitle(value: string): string {
  const entities: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&apos;": "'", "&#39;": "'" };
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|apos|#39);/g, (entity) => entities[entity] ?? entity)
    .replace(/\s+/g, " ")
    .trim();
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
  const grouped = await fetchOpenAlexJson<OpenAlexGroupedResponse>(env, "/works", {
    filter: `primary_topic.subfield.id:${subfieldId},primary_location.source.type:journal,primary_location.source.has_issn:true,type:article|review`,
    group_by: "primary_location.source.id",
    include_xpac: "false",
    per_page: String(SOURCE_DISCOVERY_LIMIT),
  });
  const sourceIds = [...new Set((grouped.group_by ?? [])
    .map((group) => normalizeOpenAlexId(String(group.key), "S"))
    .filter((id): id is string => Boolean(id)))];
  if (!sourceIds.length) return { sources: [], nextCursor: null };

  const responses: OpenAlexSourceResponse[] = [];
  for (const batch of chunk(sourceIds, OPENALEX_OR_LIMIT)) {
    responses.push(await fetchOpenAlexJson<OpenAlexSourceResponse>(env, "/sources", {
      filter: `openalex:${batch.join("|")}`,
      per_page: String(OPENALEX_OR_LIMIT),
      select: "id,display_name,issn_l,issn,type,works_count",
    }));
  }
  const rank = new Map((grouped.group_by ?? []).flatMap((group, index) => {
    const id = normalizeOpenAlexId(String(group.key), "S");
    return id ? [[id, index] as const] : [];
  }));
  const sources = responses.flatMap((response) => response.results ?? []).flatMap((source) => {
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
  sources.sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER));
  return { sources, nextCursor: null };
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
      // OpenAlex can return an opaque cursor after the final non-empty group
      // page. A short page proves that no further groups remain and avoids a
      // second request whose only result would be an empty page.
      nextCursor: groups.length < GROUPS_PER_PAGE ? null : response.meta?.next_cursor ?? null,
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
