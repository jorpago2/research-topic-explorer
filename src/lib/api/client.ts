import { z } from "zod";
import { envelopeSchema } from "./schemas";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8787").replace(/\/$/, "");

export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
    if (response.status < 500 || response.status === 501 || response.status === 505 || attempt === 2) break;
    await abortableDelay(300 * 3 ** attempt, signal);
  }
  if (!response) throw new ApiError("The research data service could not be reached.", "NETWORK_ERROR", 0);
  const retryAfter = Number(response.headers.get("Retry-After") || "");
  const json: unknown = await response.json().catch(() => null);
  const envelope = envelopeSchema(schema).safeParse(json);
  if (!envelope.success) {
    throw new ApiError("The research data service returned an invalid response.", "INVALID_RESPONSE", response.status);
  }
  if (!envelope.data.ok) {
    throw new ApiError(
      envelope.data.error.message,
      envelope.data.error.code,
      response.status,
      Number.isFinite(retryAfter) ? retryAfter : undefined,
    );
  }
  return envelope.data.data;
}

function abortableDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => {
      window.clearTimeout(timeout);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    }, { once: true });
  });
}
