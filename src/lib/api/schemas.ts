import { z } from "zod";

const sourceIdSchema = z.string().regex(/^S\d+$/);
const topicIdSchema = z.string().regex(/^T\d+$/);

export const envelopeSchema = <T extends z.ZodType>(data: T) =>
  z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), data }),
    z.object({
      ok: z.literal(false),
      error: z.object({ code: z.string(), message: z.string() }),
    }),
  ]);

export const healthSchema = z.object({ status: z.literal("ok"), version: z.string() });
export const resolveSourcesSchema = z.object({
  sources: z.array(z.object({
    id: sourceIdSchema,
    displayName: z.string(),
    issnL: z.string().nullable(),
    issns: z.array(z.string()),
    type: z.string().nullable(),
  })),
  unresolvedIssns: z.array(z.string()),
});
const hierarchyNodeSchema = z.object({ id: z.string(), displayName: z.string() });
export const subfieldsSchema = z.object({
  subfields: z.array(z.object({
    id: z.string().regex(/^\d{1,8}$/),
    displayName: z.string(),
    field: hierarchyNodeSchema.nullable(),
    domain: hierarchyNodeSchema.nullable(),
  })),
});
export const subfieldSourcesSchema = z.object({
  sources: z.array(z.object({
    id: sourceIdSchema,
    displayName: z.string(),
    issnL: z.string().nullable(),
    issns: z.array(z.string()),
    type: z.string().nullable(),
    worksCount: z.number().int().nonnegative(),
  })),
  nextCursor: z.string().nullable(),
});
export const groupedSchema = z.object({
  meta: z.object({
    documentCount: z.number().int().nonnegative(),
    nextCursor: z.string().nullable(),
    costUsd: z.number().nonnegative().optional(),
  }),
  groups: z.array(z.object({ id: z.string(), displayName: z.string(), count: z.number().int().nonnegative() })),
});
export const topicDetailsSchema = z.object({
  topics: z.array(z.object({
    id: topicIdSchema,
    displayName: z.string(),
    description: z.string().nullable(),
    keywords: z.array(z.string()),
    subfield: hierarchyNodeSchema.nullable(),
    field: hierarchyNodeSchema.nullable(),
    domain: hierarchyNodeSchema.nullable(),
  })),
});
