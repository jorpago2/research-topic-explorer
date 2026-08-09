export const OPENALEX_OR_LIMIT = 100;
export const MAX_ISSNS = 500;
export const MAX_SOURCE_IDS = 100;
export const MAX_TOPIC_IDS = 40;
export const MAX_NETWORK_NODES = 40;
export const MAX_YEAR_RANGE = 15;
export const MIN_PUBLICATION_YEAR = 1800;
export const MAX_REQUEST_BODY_BYTES = 32_768;
export const GROUPS_PER_PAGE = 200;
export const TOPIC_DETAILS_CONCURRENCY = 4;
export const SOURCE_DISCOVERY_PAGE_SIZE = 100;
export const CACHE_SCHEMA_VERSION = "4";

export const CACHE_TTL_SECONDS = {
  sourceResolution: 30 * 24 * 60 * 60,
  historicalAggregation: 7 * 24 * 60 * 60,
  currentAggregation: 12 * 60 * 60,
  topicDetails: 30 * 24 * 60 * 60,
  taxonomy: 30 * 24 * 60 * 60,
} as const;
