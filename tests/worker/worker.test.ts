// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleRequest } from "../../worker/src/index";
import { stableStringify } from "../../worker/src/cache/key";
import type { Env } from "../../worker/src/types/env";

const origin = "https://researcher.github.io";
const env: Env = { OPENALEX_API_KEY: "test-secret-never-return", ALLOWED_ORIGINS: origin };

function request(path: string, body?: unknown, requestOrigin = origin, method = body === undefined ? "GET" : "POST") {
  return new Request(`https://worker.example${path}`, {
    method,
    headers: { Origin: requestOrigin, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Worker security boundary", () => {
  it("adds the secret upstream but never returns it downstream", async () => {
    let upstreamUrl = "";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      upstreamUrl = String(input);
      return Response.json({ meta: { count: 10, next_cursor: null }, group_by: [{ key: "https://openalex.org/T1", key_display_name: "Topic", count: 10 }] });
    }));
    const response = await handleRequest(request("/v1/group-primary-topics", { sourceIds: ["S123"], year: 2024, types: ["article", "review"], cursor: "*" }), env);
    const text = await response.text();
    expect(upstreamUrl).toContain("api_key=test-secret-never-return");
    expect(upstreamUrl).toContain("include_xpac=false");
    expect(upstreamUrl).not.toContain("primary_topic.subfield.id");
    expect(text).not.toContain("test-secret-never-return");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  });
  it.each([
    [{ sourceIds: ["bad"], year: 2024, types: [] }, 422],
    [{ sourceIds: ["S1"], year: 2024, types: [], filter: "arbitrary:true" }, 422],
    [{ sourceIds: ["S1"], year: 2024, types: [], url: "https://example.com" }, 422],
    [{ sourceIds: ["S1"], year: 2024, types: [], subfieldId: "3107|malicious" }, 422],
    [{ sourceIds: Array.from({ length: 101 }, (_, index) => `S${index + 1}`), year: 2024, types: [] }, 422],
  ])("rejects invalid or expansive request bodies", async (body, expectedStatus) => {
    const response = await handleRequest(request("/v1/group-primary-topics", body), env);
    expect(response.status).toBe(expectedStatus);
  });
  it("rejects wrong origins and unknown routes", async () => {
    expect((await handleRequest(request("/health", undefined, "https://evil.example"), env)).status).toBe(403);
    expect((await handleRequest(request("/v1/not-a-route", {}), env)).status).toBe(404);
  });
  it("handles preflight with exact CORS", async () => {
    const response = await handleRequest(request("/v1/resolve-sources", undefined, origin, "OPTIONS"), env);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(response.headers.get("Vary")).toBe("Origin");
  });
  it("sanitizes OpenAlex rate-limit and server errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("upstream-secret-detail", { status: 429, headers: { "Retry-After": "30" } })));
    const response = await handleRequest(request("/v1/group-primary-topics", { sourceIds: ["S1"], year: 2024, types: [] }), env);
    expect(response.status).toBe(429);
    expect(await response.text()).not.toContain("upstream-secret-detail");
  });
  it("builds deterministic cache material", () => {
    expect(stableStringify({ b: [2, 1], a: "x" })).toBe(stableStringify({ a: "x", b: [2, 1] }));
  });
  it("does not spend the upstream rate allowance on a cache hit", async () => {
    const limit = vi.fn(async () => ({ success: false }));
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({
        match: vi.fn(async () => Response.json({ ok: true, data: { meta: { documentCount: 10, nextCursor: null }, groups: [] } })),
        put: vi.fn(),
      })),
    });
    const response = await handleRequest(
      request("/v1/group-primary-topics", { sourceIds: ["S1"], year: 2024, types: [], cursor: "*" }),
      { ...env, API_RATE_LIMITER: { limit } as Env["API_RATE_LIMITER"] },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("X-App-Cache")).toBe("HIT");
    expect(limit).not.toHaveBeenCalled();
  });
  it("still rate-limits a cache miss before contacting OpenAlex", async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const upstreamFetch = vi.fn();
    vi.stubGlobal("fetch", upstreamFetch);
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({ match: vi.fn(async () => undefined), put: vi.fn() })),
    });
    const response = await handleRequest(
      request("/v1/group-primary-topics", { sourceIds: ["S1"], year: 2024, types: [], cursor: "*" }),
      { ...env, API_RATE_LIMITER: { limit } as Env["API_RATE_LIMITER"] },
    );
    expect(response.status).toBe(429);
    expect(limit).toHaveBeenCalledOnce();
    expect(upstreamFetch).not.toHaveBeenCalled();
  });
  it("stops grouped paging after a non-full OpenAlex page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      meta: { count: 10, next_cursor: "terminal-cursor" },
      group_by: [{ key: "https://openalex.org/T1", key_display_name: "Topic", count: 10 }],
    })));
    const response = await handleRequest(request("/v1/group-primary-topics", { sourceIds: ["S1"], year: 2024, types: [], cursor: "*" }), env);
    expect(await response.json()).toMatchObject({ ok: true, data: { meta: { nextCursor: null } } });
  });
  it("preserves the cursor after a full 200-group OpenAlex page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      meta: { count: 200, next_cursor: "next-group-page" },
      group_by: Array.from({ length: 200 }, (_, index) => ({ key: `https://openalex.org/T${index + 1}`, key_display_name: `Topic ${index + 1}`, count: 1 })),
    })));
    const response = await handleRequest(request("/v1/group-primary-topics", { sourceIds: ["S1"], year: 2024, types: [], cursor: "*" }), env);
    expect(await response.json()).toMatchObject({ ok: true, data: { meta: { nextCursor: "next-group-page" } } });
  });
  it.each([
    ["/v1/group-primary-topics", { sourceIds: ["S1"], year: 2024, types: [], cursor: "*", subfieldId: "3107" }, "primary_topic.subfield.id%3A3107"],
    ["/v1/group-sources", { sourceIds: ["S1"], year: 2024, types: [], cursor: "*", subfieldId: "3107" }, "primary_topic.subfield.id%3A3107"],
    ["/v1/group-category-years", { sourceIds: ["S1"], startYear: 2020, endYear: 2024, types: [], subfieldId: "3107" }, "primary_topic.subfield.id%3A3107"],
    ["/v1/group-topic-years", { sourceIds: ["S1"], topicId: "T1", startYear: 2020, endYear: 2024, types: [], subfieldId: "3107" }, "primary_topic.id%3AT1%2Cprimary_topic.subfield.id%3A3107"],
    ["/v1/group-topic-cooccurrence", { sourceIds: ["S1"], seedTopicId: "T1", year: 2024, types: [], cursor: "*", subfieldId: "3107" }, "topics.id%3AT1%2Cprimary_topic.subfield.id%3A3107"],
  ])("applies the validated strict-subfield filter to %s", async (path, body, expectedFilter) => {
    let upstreamUrl = "";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      upstreamUrl = String(input);
      return Response.json({ meta: { count: 0, next_cursor: null }, group_by: [] });
    }));
    const response = await handleRequest(request(path, body), env);
    expect(response.status).toBe(200);
    expect(upstreamUrl).toContain(expectedFilter);
  });
  it("returns the bounded OpenAlex subfield taxonomy", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      meta: { next_cursor: null },
      results: [{ id: "https://openalex.org/subfields/3107", display_name: "Optics", field: { id: "https://openalex.org/fields/31", display_name: "Physics and Astronomy" }, domain: { id: "https://openalex.org/domains/3", display_name: "Physical Sciences" } }],
    })));
    const response = await handleRequest(request("/v1/openalex-subfields", {}), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, data: { subfields: [{ id: "3107", displayName: "Optics" }] } });
  });
  it("discovers only ISSN-bearing journal Sources from a validated subfield", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/works?")) return Response.json({ meta: {}, group_by: [{ key: "https://openalex.org/S1", key_display_name: "Optics Express", count: 100 }] });
      return Response.json({ meta: { next_cursor: null }, results: [{ id: "https://openalex.org/S1", display_name: "Optics Express", issn_l: "1094-4087", issn: ["1094-4087"], type: "journal", works_count: 1000 }] });
    }));
    const response = await handleRequest(request("/v1/openalex-subfield-sources", { subfieldId: "3107", cursor: "*" }), env);
    expect(response.status).toBe(200);
    expect(urls[0]).toContain("primary_topic.subfield.id%3A3107");
    expect(urls[0]).toContain("primary_location.source.type%3Ajournal");
    expect(urls[0]).toContain("include_xpac=false");
    expect(urls[0]).not.toContain("cursor=");
    expect(urls[1]).toContain("openalex%3AS1");
    expect(await response.text()).not.toContain("test-secret-never-return");
  });
  it("rejects arbitrary OpenAlex taxonomy input", async () => {
    const response = await handleRequest(request("/v1/openalex-subfield-sources", { subfieldId: "3107|malicious", cursor: "*" }), env);
    expect(response.status).toBe(422);
  });
  it("validates the current calendar year at request time", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ meta: { count: 0, next_cursor: null }, group_by: [] })));
    const currentYear = new Date().getUTCFullYear();
    const accepted = await handleRequest(request("/v1/group-primary-topics", { sourceIds: ["S1"], year: currentYear, types: [], cursor: "*" }), env);
    const rejected = await handleRequest(request("/v1/group-primary-topics", { sourceIds: ["S1"], year: currentYear + 1, types: [], cursor: "*" }), env);
    expect(accepted.status).toBe(200);
    expect(rejected.status).toBe(422);
  });
});
