import type { RateLimit } from "@cloudflare/workers-types";

export interface Env {
  OPENALEX_API_KEY: string;
  ALLOWED_ORIGINS: string;
  API_RATE_LIMITER?: RateLimit;
}

export type ErrorCode =
  | "INVALID_REQUEST"
  | "ORIGIN_NOT_ALLOWED"
  | "CATEGORY_INPUT_TOO_LARGE"
  | "OPENALEX_BAD_REQUEST"
  | "OPENALEX_RATE_LIMITED"
  | "OPENALEX_UNAVAILABLE"
  | "INTERNAL_ERROR";

export interface AppErrorShape {
  code: ErrorCode;
  message: string;
  status: number;
  retryAfter?: string;
}
