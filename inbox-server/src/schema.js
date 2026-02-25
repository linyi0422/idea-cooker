import { z } from "zod";

export const captureItemSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1).max(200),
  note: z.string().min(5).max(280),
  tags: z.array(z.string().min(1).max(32)).max(20).optional().default([]),
  source: z.enum(["xhs", "douyin", "x", "wechat", "other"]),
});

export function normalizeInput(raw) {
  const parsed = captureItemSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  return {
    ok: true,
    data: {
      ...parsed.data,
      title: parsed.data.title.trim(),
      note: parsed.data.note.trim(),
      tags: parsed.data.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean),
    },
  };
}
