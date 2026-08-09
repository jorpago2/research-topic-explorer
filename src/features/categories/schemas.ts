import { z } from "zod";

export const categoryIndexEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  taxonomy: z.string().min(1),
  edition: z.string().min(1).optional(),
  file: z.string().regex(/^[a-z0-9][a-z0-9._-]*\.json$/),
});

export const categoryIndexSchema = z.object({
  schemaVersion: z.literal(1),
  categories: z.array(categoryIndexEntrySchema),
});

export const categoryDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  taxonomy: z.string().min(1),
  edition: z.string().min(1).optional(),
  sourceNote: z.string().min(1),
  journals: z.array(z.object({
    name: z.string().min(1),
    issns: z.array(z.string().min(1)).min(1),
  })),
});

export type CategoryIndex = z.infer<typeof categoryIndexSchema>;
