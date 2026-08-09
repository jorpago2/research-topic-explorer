import { z } from "zod";
import {
  MAX_ISSNS,
  MAX_SOURCE_IDS,
  MAX_TOPIC_IDS,
  MAX_YEAR_RANGE,
  MIN_PUBLICATION_YEAR,
} from "../openalex/constants";
import { normalizeIssn } from "./issn";

const sourceId = z.string().transform((value) => value.trim().toUpperCase()).pipe(z.string().regex(/^S\d+$/));
const topicId = z.string().transform((value) => value.trim().toUpperCase()).pipe(z.string().regex(/^T\d+$/));
const subfieldId = z.union([z.string(), z.number().int()])
  .transform((value) => String(value).trim().replace(/^https?:\/\/openalex\.org\/subfields\//i, ""))
  .pipe(z.string().regex(/^\d{1,8}$/));
const currentYear = new Date().getUTCFullYear();
const publicationYear = z.number().int().min(MIN_PUBLICATION_YEAR).max(currentYear);
const documentTypes = z.array(z.enum(["article", "review"])).max(2).refine((values) => new Set(values).size === values.length, "Duplicate work types are not allowed.");
const sourceIds = z.array(sourceId).min(1).max(MAX_SOURCE_IDS).transform((values) => [...new Set(values)].sort());

export const resolveSourcesRequestSchema = z.object({
  issns: z.array(z.string()).min(1).max(MAX_ISSNS).transform((values, context) => {
    const normalized = values.map(normalizeIssn);
    normalized.forEach((value, index) => {
      if (!value) context.addIssue({ code: "custom", message: `Invalid ISSN at position ${index}.` });
    });
    return [...new Set(normalized.filter((value): value is string => Boolean(value)))].sort();
  }),
}).strict();

export const groupedYearRequestSchema = z.object({
  sourceIds,
  year: publicationYear,
  types: documentTypes,
  cursor: z.string().min(1).max(2048).default("*"),
}).strict();

export const topicDetailsRequestSchema = z.object({
  topicIds: z.array(topicId).min(1).max(MAX_TOPIC_IDS).transform((values) => [...new Set(values)].sort()),
}).strict();

export const topicYearsRequestSchema = z.object({
  sourceIds,
  topicId,
  startYear: publicationYear,
  endYear: publicationYear,
  types: documentTypes,
}).strict().refine((value) => value.endYear >= value.startYear, {
  message: "endYear must be greater than or equal to startYear.",
}).refine((value) => value.endYear - value.startYear + 1 <= MAX_YEAR_RANGE, {
  message: `Publication-year range cannot exceed ${MAX_YEAR_RANGE} years.`,
});

export const categoryYearsRequestSchema = z.object({
  sourceIds,
  startYear: publicationYear,
  endYear: publicationYear,
  types: documentTypes,
}).strict().refine((value) => value.endYear >= value.startYear, {
  message: "endYear must be greater than or equal to startYear.",
}).refine((value) => value.endYear - value.startYear + 1 <= MAX_YEAR_RANGE, {
  message: `Publication-year range cannot exceed ${MAX_YEAR_RANGE} years.`,
});

export const cooccurrenceRequestSchema = z.object({
  sourceIds,
  seedTopicId: topicId,
  year: publicationYear,
  types: documentTypes,
  cursor: z.string().min(1).max(2048).default("*"),
}).strict();

export const subfieldsRequestSchema = z.object({}).strict();

export const subfieldSourcesRequestSchema = z.object({
  subfieldId,
  cursor: z.string().min(1).max(2048).default("*"),
}).strict();

export type GroupedYearRequest = z.infer<typeof groupedYearRequestSchema>;
export type TopicYearsRequest = z.infer<typeof topicYearsRequestSchema>;
export type CategoryYearsRequest = z.infer<typeof categoryYearsRequestSchema>;
export type CooccurrenceRequest = z.infer<typeof cooccurrenceRequestSchema>;
