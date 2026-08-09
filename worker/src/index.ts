import { z } from "zod";
import { createCacheKey } from "./cache/key";
import { CACHE_TTL_SECONDS, MAX_REQUEST_BODY_BYTES } from "./openalex/constants";
import { OpenAlexUpstreamError } from "./openalex/client";
import { getTopicDetails, groupWorks, listSubfields, listSubfieldSources, resolveSources } from "./openalex/operations";
import type { AppErrorShape, Env } from "./types/env";
import {
  categoryYearsRequestSchema,
  cooccurrenceRequestSchema,
  groupedYearRequestSchema,
  resolveSourcesRequestSchema,
  topicDetailsRequestSchema,
  topicYearsRequestSchema,
  subfieldsRequestSchema,
  subfieldSourcesRequestSchema,
} from "./validation/schemas";

const ROUTES = new Set([
  "/v1/resolve-sources",
  "/v1/group-primary-topics",
  "/v1/topic-details",
  "/v1/group-topic-years",
  "/v1/group-category-years",
  "/v1/group-sources",
  "/v1/group-topic-cooccurrence",
  "/v1/openalex-subfields",
  "/v1/openalex-subfield-sources",
]);

function allowedOrigins(env: Env): Set<string> {
  return new Set(env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean));
}

function corsHeaders(origin: string): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  });
}

function jsonResponse(data: unknown, status: number, origin: string, extraHeaders?: HeadersInit): Response {
  const headers = corsHeaders(origin);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("X-Content-Type-Options", "nosniff");
  if (extraHeaders) new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
  return new Response(JSON.stringify(data), { status, headers });
}

function errorResponse(error: AppErrorShape, origin: string): Response {
  return jsonResponse(
    { ok: false, error: { code: error.code, message: error.message } },
    error.status,
    origin,
    error.retryAfter ? { "Retry-After": error.retryAfter } : undefined,
  );
}

async function parseBody(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("Content-Length") || "0");
  if (contentLength > MAX_REQUEST_BODY_BYTES) throw new Error("REQUEST_TOO_LARGE");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BODY_BYTES) throw new Error("REQUEST_TOO_LARGE");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("INVALID_JSON");
  }
}

function aggregationTtl(year: number): number {
  return year === new Date().getUTCFullYear()
    ? CACHE_TTL_SECONDS.currentAggregation
    : CACHE_TTL_SECONDS.historicalAggregation;
}

function assertNoFutureYears(value: unknown): void {
  if (!value || typeof value !== "object") return;
  const currentYear = new Date().getUTCFullYear();
  for (const key of ["year", "startYear", "endYear"] as const) {
    const candidate = (value as Record<string, unknown>)[key];
    if (typeof candidate === "number" && candidate > currentYear) throw new Error("FUTURE_YEAR");
  }
}

function primarySubfieldFilter(subfieldId?: string): string | undefined {
  return subfieldId ? `primary_topic.subfield.id:${subfieldId}` : undefined;
}

function combineFilters(...filters: Array<string | undefined>): string | undefined {
  const values = filters.filter((value): value is string => Boolean(value));
  return values.length ? values.join(",") : undefined;
}

async function executeRoute(path: string, body: unknown, env: Env): Promise<{ data: unknown; ttl: number; normalizedBody: unknown }> {
  switch (path) {
    case "/v1/resolve-sources": {
      const normalizedBody = resolveSourcesRequestSchema.parse(body);
      return { data: await resolveSources(env, normalizedBody.issns), ttl: CACHE_TTL_SECONDS.sourceResolution, normalizedBody };
    }
    case "/v1/openalex-subfields": {
      const normalizedBody = subfieldsRequestSchema.parse(body);
      return { data: await listSubfields(env), ttl: CACHE_TTL_SECONDS.taxonomy, normalizedBody };
    }
    case "/v1/openalex-subfield-sources": {
      const normalizedBody = subfieldSourcesRequestSchema.parse(body);
      return { data: await listSubfieldSources(env, normalizedBody.subfieldId, normalizedBody.cursor), ttl: CACHE_TTL_SECONDS.taxonomy, normalizedBody };
    }
    case "/v1/group-primary-topics": {
      const normalizedBody = groupedYearRequestSchema.parse(body);
      return { data: await groupWorks(env, normalizedBody.sourceIds, normalizedBody.year, normalizedBody.types, "primary_topic.id", normalizedBody.cursor, primarySubfieldFilter(normalizedBody.subfieldId)), ttl: aggregationTtl(normalizedBody.year), normalizedBody };
    }
    case "/v1/topic-details": {
      const normalizedBody = topicDetailsRequestSchema.parse(body);
      return { data: await getTopicDetails(env, normalizedBody.topicIds), ttl: CACHE_TTL_SECONDS.topicDetails, normalizedBody };
    }
    case "/v1/group-topic-years": {
      const normalizedBody = topicYearsRequestSchema.parse(body);
      return { data: await groupWorks(env, normalizedBody.sourceIds, `${normalizedBody.startYear}-${normalizedBody.endYear}`, normalizedBody.types, "publication_year", "*", combineFilters(`primary_topic.id:${normalizedBody.topicId}`, primarySubfieldFilter(normalizedBody.subfieldId))), ttl: aggregationTtl(normalizedBody.endYear), normalizedBody };
    }
    case "/v1/group-category-years": {
      const normalizedBody = categoryYearsRequestSchema.parse(body);
      return { data: await groupWorks(env, normalizedBody.sourceIds, `${normalizedBody.startYear}-${normalizedBody.endYear}`, normalizedBody.types, "publication_year", "*", primarySubfieldFilter(normalizedBody.subfieldId)), ttl: aggregationTtl(normalizedBody.endYear), normalizedBody };
    }
    case "/v1/group-sources": {
      const normalizedBody = groupedYearRequestSchema.parse(body);
      return { data: await groupWorks(env, normalizedBody.sourceIds, normalizedBody.year, normalizedBody.types, "primary_location.source.id", normalizedBody.cursor, primarySubfieldFilter(normalizedBody.subfieldId)), ttl: aggregationTtl(normalizedBody.year), normalizedBody };
    }
    case "/v1/group-topic-cooccurrence": {
      const normalizedBody = cooccurrenceRequestSchema.parse(body);
      return { data: await groupWorks(env, normalizedBody.sourceIds, normalizedBody.year, normalizedBody.types, "topics.id", normalizedBody.cursor, combineFilters(`topics.id:${normalizedBody.seedTopicId}`, primarySubfieldFilter(normalizedBody.subfieldId))), ttl: aggregationTtl(normalizedBody.year), normalizedBody };
    }
    default:
      throw new Error("UNKNOWN_ROUTE");
  }
}

function mapError(error: unknown): AppErrorShape {
  if (error instanceof z.ZodError) return { code: "INVALID_REQUEST", message: "The request parameters are invalid or exceed an allowed limit.", status: 422 };
  if (error instanceof OpenAlexUpstreamError) {
    if (error.status === 429) return { code: "OPENALEX_RATE_LIMITED", message: "The research data service is temporarily rate-limited. Please try again later.", status: 429, retryAfter: error.retryAfter };
    if (error.status >= 500) return { code: "OPENALEX_UNAVAILABLE", message: "The research data service is temporarily unavailable.", status: 503 };
    return { code: "OPENALEX_BAD_REQUEST", message: "The research data service rejected the validated query.", status: 502 };
  }
  if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") return { code: "CATEGORY_INPUT_TOO_LARGE", message: "The request body exceeds the allowed size.", status: 413 };
  if (error instanceof Error && error.message === "INVALID_JSON") return { code: "INVALID_REQUEST", message: "The request body is not valid JSON.", status: 400 };
  if (error instanceof Error && error.message === "FUTURE_YEAR") return { code: "INVALID_REQUEST", message: "Publication years cannot be later than the current calendar year.", status: 422 };
  return { code: "INTERNAL_ERROR", message: "The request could not be completed.", status: 500 };
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin") || "";
  if (!allowedOrigins(env).has(origin)) {
    return new Response(JSON.stringify({ ok: false, error: { code: "ORIGIN_NOT_ALLOWED", message: "This origin is not allowed." } }), {
      status: 403,
      headers: { "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff" },
    });
  }
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (url.pathname === "/health" && request.method === "GET") {
    return jsonResponse({ ok: true, data: { status: "ok", version: "v1" } }, 200, origin, { "Cache-Control": "public, max-age=60" });
  }
  if (request.method !== "POST" || !ROUTES.has(url.pathname)) {
    return jsonResponse({ ok: false, error: { code: "INVALID_REQUEST", message: "The requested operation does not exist." } }, 404, origin);
  }

  try {
    const body = await parseBody(request);
    const parsed = await normalizeForCache(url.pathname, body);
    assertNoFutureYears(parsed);
    const cacheKey = await createCacheKey(url.pathname, parsed);
    const cache = typeof caches === "undefined" ? null : await caches.open("research-topic-explorer-v2");
    const cached = cache ? await cache.match(cacheKey) : undefined;
    if (cached) return jsonResponse(await cached.json(), 200, origin, { "X-App-Cache": "HIT" });

    // Cached responses do not contact OpenAlex and should not consume the
    // client's upstream-request allowance. Unique cache misses remain bounded.
    if (env.API_RATE_LIMITER) {
      const client = request.headers.get("CF-Connecting-IP") || "unknown";
      const limit = await env.API_RATE_LIMITER.limit({ key: `${origin}:${client}` });
      if (!limit.success) return errorResponse({ code: "OPENALEX_RATE_LIMITED", message: "This client has reached the request limit. Please wait before retrying.", status: 429, retryAfter: "60" }, origin);
    }

    const result = await executeRoute(url.pathname, body, env);
    const envelope = { ok: true, data: result.data };
    if (cache) {
      const cacheResponse = new Response(JSON.stringify(envelope), {
        headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${result.ttl}` },
      });
      await cache.put(cacheKey, cacheResponse);
    }
    return jsonResponse(envelope, 200, origin, { "X-App-Cache": "MISS" });
  } catch (error) {
    return errorResponse(mapError(error), origin);
  }
}

function normalizeForCache(path: string, body: unknown): unknown {
  switch (path) {
    case "/v1/openalex-subfields": return subfieldsRequestSchema.parse(body);
    case "/v1/openalex-subfield-sources": return subfieldSourcesRequestSchema.parse(body);
    case "/v1/resolve-sources": return resolveSourcesRequestSchema.parse(body);
    case "/v1/topic-details": return topicDetailsRequestSchema.parse(body);
    case "/v1/group-topic-years": return topicYearsRequestSchema.parse(body);
    case "/v1/group-category-years": return categoryYearsRequestSchema.parse(body);
    case "/v1/group-topic-cooccurrence": return cooccurrenceRequestSchema.parse(body);
    default: return groupedYearRequestSchema.parse(body);
  }
}

export default { fetch: handleRequest };
export { handleRequest };
