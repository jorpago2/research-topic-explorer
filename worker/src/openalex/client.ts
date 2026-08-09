import type { Env } from "../types/env";

const OPENALEX_BASE_URL = "https://api.openalex.org";

export class OpenAlexUpstreamError extends Error {
  constructor(readonly status: number, readonly retryAfter?: string) {
    super(`OpenAlex request failed with status ${status}.`);
    this.name = "OpenAlexUpstreamError";
  }
}

export async function fetchOpenAlexJson<T>(
  env: Env,
  path: `/sources` | `/works` | `/topics` | `/topics/${string}` | `/subfields`,
  parameters: Record<string, string>,
): Promise<T> {
  const url = new URL(path, OPENALEX_BASE_URL);
  const search = new URLSearchParams(parameters);
  search.set("api_key", env.OPENALEX_API_KEY);
  url.search = search.toString();
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "research-topic-explorer/0.1" },
  });
  if (!response.ok) throw new OpenAlexUpstreamError(response.status, response.headers.get("Retry-After") ?? undefined);
  return response.json() as Promise<T>;
}

export function normalizeOpenAlexId(value: unknown, prefix: "S" | "T" | "I"): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.replace(/^https?:\/\/openalex\.org\//i, "").toUpperCase();
  return new RegExp(`^${prefix}\\d+$`).test(candidate) ? candidate : null;
}
