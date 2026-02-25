import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAtomService } from "../src/atoms-service.js";

describe("atoms smoke (real provider)", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "atoms-smoke-"));
    const now = new Date().toISOString();
    const lines = [
      {
        id: "itm_smoke_1",
        url: "https://example.com/smoke",
        canonical_url: "https://example.com/smoke",
        title: "Smoke source title",
        note: "A short source note for smoke testing atom generation.",
        tags: ["smoke"],
        source: "other",
        captured_at: now,
        client: "extension",
      },
    ]
      .map((item) => JSON.stringify(item))
      .join("\n");
    fs.writeFileSync(path.join(tempDir, "items.jsonl"), `${lines}\n`, "utf8");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const hasOpenAiEnv = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);

  it.skipIf(!hasOpenAiEnv)(
    "calls openai provider once and returns valid atom structure",
    async () => {
      const service = createAtomService({ inboxDir: tempDir });
      const result = await service.generate({
        goal: "inspire",
        dedupe_strength: "medium",
        novelty: "balanced",
        count: 3,
        filters: { days: 30 },
        model: {
          provider: "openai",
          model: process.env.OPENAI_MODEL,
          temperature: 0.7,
        },
      });

      expect(result.ok).toBe(true);
      expect(result.atoms.length).toBeGreaterThan(0);
      expect(result.atoms[0].hook.length).toBeGreaterThan(0);
      expect(result.atoms[0].source_item_ids.length).toBeGreaterThan(0);
    }
  );
});
