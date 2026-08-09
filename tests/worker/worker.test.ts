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

afterEach(() => vi.restoreAllMocks());

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
    expect(text).not.toContain("test-secret-never-return");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  });
  it.each([
    [{ sourceIds: ["bad"], year: 2024, types: [] }, 422],
    [{ sourceIds: ["S1"], year: 2024, types: [], filter: "arbitrary:true" }, 422],
    [{ sourceIds: ["S1"], year: 2024, types: [], url: "https://example.com" }, 422],
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
});
