import { z } from "zod";
import { normalizeIssn } from "../../lib/issn";

export const jifDatasetSchema = z.object({
  schemaVersion: z.literal(1),
  provider: z.literal("Clarivate"),
  metric: z.literal("Journal Impact Factor"),
  edition: z.string().min(1),
  sourceNote: z.string().min(1),
  journals: z.array(z.object({
    journalName: z.string().min(1),
    eissn: z.string().regex(/^\d{4}-[\dX]{4}$/).refine((value) => normalizeIssn(value) !== null, "Invalid ISSN checksum."),
    index: z.string(),
    citations: z.number().int().nonnegative().nullable(),
    jif: z.number().nonnegative().nullable(),
    previousJif: z.number().nonnegative().nullable(),
    quartile: z.enum(["Q1", "Q2", "Q3", "Q4"]).nullable(),
    edition: z.string().min(1),
    provider: z.literal("Clarivate"),
  })).min(1).max(50_000),
}).superRefine((dataset, context) => {
  const seenIssns = new Set<string>();
  dataset.journals.forEach((journal, index) => {
    if (journal.edition !== dataset.edition) {
      context.addIssue({ code: "custom", path: ["journals", index, "edition"], message: "Journal edition must match the dataset edition." });
    }
    if (seenIssns.has(journal.eissn)) {
      context.addIssue({ code: "custom", path: ["journals", index, "eissn"], message: "Duplicate eISSN." });
    }
    seenIssns.add(journal.eissn);
  });
});
