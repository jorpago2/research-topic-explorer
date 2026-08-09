import { CACHE_SCHEMA_VERSION } from "../openalex/constants";

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function createCacheKey(route: string, normalizedBody: unknown): Promise<Request> {
  const material = stableStringify({ schema: CACHE_SCHEMA_VERSION, route, body: normalizedBody });
  const bytes = new TextEncoder().encode(material);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return new Request(`https://research-topic-explorer-cache.invalid/${CACHE_SCHEMA_VERSION}/${hash}`, { method: "GET" });
}
