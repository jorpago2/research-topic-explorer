import { z } from "zod";

export const jifDatasetIndexSchema = z.object({
  schemaVersion: z.literal(1),
  datasets: z.array(z.object({
    edition: z.string().min(1),
    file: z.string().regex(/^[A-Za-z0-9._-]+\.json$/),
  })),
});

export const jifDatasetSchema = z.object({
  schemaVersion: z.literal(1),
  provider: z.literal("Clarivate"),
  metric: z.literal("Journal Impact Factor"),
  edition: z.string().min(1),
  sourceNote: z.string().min(1),
  journals: z.array(z.object({
    journalName: z.string().min(1),
    eissn: z.string().regex(/^\d{4}-[\dX]{4}$/),
    index: z.string(),
    citations: z.number().int().nonnegative().nullable(),
    jif: z.number().nonnegative().nullable(),
    previousJif: z.number().nonnegative().nullable(),
    quartile: z.enum(["Q1", "Q2", "Q3", "Q4"]).nullable(),
    edition: z.string().min(1),
    provider: z.literal("Clarivate"),
  })),
});
