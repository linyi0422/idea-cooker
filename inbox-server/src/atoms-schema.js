import { z } from "zod";

const goalSchema = z.enum(["inspire", "publishable", "reusable"]);
const dedupeStrengthSchema = z.enum(["low", "medium", "high"]);
const noveltySchema = z.enum(["safe", "balanced", "bold"]);

const filtersSchema = z
  .object({
    tags: z.array(z.string().min(1).max(32)).optional().default([]),
    sources: z.array(z.enum(["xhs", "douyin", "x", "wechat", "other"])).optional().default([]),
    days: z.number().int().min(1).max(365).optional(),
  })
  .optional()
  .default({});

const modelSchema = z.object({
  provider: z.string().min(1).max(32),
  model: z.string().min(1).max(100),
  temperature: z.number().min(0).max(2).optional().default(0.7),
});

export const atomGenerationRequestSchema = z.object({
  goal: goalSchema,
  dedupe_strength: dedupeStrengthSchema,
  novelty: noveltySchema,
  count: z.number().int().min(1).max(30).optional().default(15),
  filters: filtersSchema,
  model: modelSchema,
});

export const atomOutputSchema = z.object({
  hook: z.string().min(1).max(180),
  thesis: z.string().min(1).max(280),
  evidence_snippet: z.string().min(1).max(320),
  tone: z.string().min(1).max(64),
  audience: z.string().min(1).max(100),
  reusable_sentence: z.string().min(1).max(320),
  source_item_ids: z.array(z.string().min(1)).min(1).max(10),
  confidence: z.number().min(0).max(1).optional(),
});

export function normalizeAtomGenerationRequest(raw) {
  const parsed = atomGenerationRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  const data = parsed.data;
  return {
    ok: true,
    data: {
      ...data,
      filters: {
        tags: (data.filters?.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean),
        sources: data.filters?.sources ?? [],
        days: data.filters?.days,
      },
      model: {
        provider: data.model.provider.trim().toLowerCase(),
        model: data.model.model.trim(),
        temperature: data.model.temperature ?? 0.7,
      },
    },
  };
}

export function normalizeGeneratedAtoms(rawAtoms) {
  if (!Array.isArray(rawAtoms)) {
    return {
      ok: false,
      details: [{ path: "atoms", message: "Expected array from provider output." }],
    };
  }

  const atoms = [];
  const details = [];
  rawAtoms.forEach((rawAtom, index) => {
    const parsed = atomOutputSchema.safeParse(rawAtom);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        details.push({
          path: `atoms.${index}.${issue.path.join(".")}`,
          message: issue.message,
        });
      });
      return;
    }

    atoms.push({
      ...parsed.data,
      hook: parsed.data.hook.trim(),
      thesis: parsed.data.thesis.trim(),
      evidence_snippet: parsed.data.evidence_snippet.trim(),
      tone: parsed.data.tone.trim(),
      audience: parsed.data.audience.trim(),
      reusable_sentence: parsed.data.reusable_sentence.trim(),
      source_item_ids: parsed.data.source_item_ids.map((value) => value.trim()).filter(Boolean),
      confidence: parsed.data.confidence ?? 0.5,
    });
  });

  if (details.length > 0) {
    return { ok: false, details };
  }

  return { ok: true, data: atoms };
}
