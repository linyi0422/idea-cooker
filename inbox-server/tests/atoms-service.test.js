import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAtomService } from "../src/atoms-service.js";

function writeJsonl(filePath, records) {
  const payload = records.map((record) => JSON.stringify(record)).join("\n");
  fs.writeFileSync(filePath, `${payload}\n`, "utf8");
}

describe("atom service", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "atoms-test-"));
    const now = new Date().toISOString();
    writeJsonl(path.join(tempDir, "items.jsonl"), [
      {
        id: "itm_1",
        url: "https://example.com/a",
        canonical_url: "https://example.com/a",
        title: "Post A",
        note: "about writing focus",
        tags: ["writing"],
        source: "x",
        captured_at: now,
        client: "extension",
      },
      {
        id: "itm_2",
        url: "https://example.com/b",
        canonical_url: "https://example.com/b",
        title: "Post B",
        note: "about strong hooks",
        tags: ["hook"],
        source: "wechat",
        captured_at: now,
        client: "extension",
      },
    ]);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("deduplicates generated atoms and persists run", async () => {
    const service = createAtomService({
      inboxDir: tempDir,
      providerRegistry: {
        mock: {
          async generateAtoms() {
            return [
              {
                hook: "How to keep writing every day",
                thesis: "Use tiny repeatable writing slots.",
                evidence_snippet: "User note about writing focus.",
                tone: "practical",
                audience: "creators",
                reusable_sentence: "Small slots beat random motivation.",
                source_item_ids: ["itm_1"],
              },
              {
                hook: "How to keep writing every day",
                thesis: "Use tiny repeatable writing slots.",
                evidence_snippet: "Another similar angle.",
                tone: "practical",
                audience: "creators",
                reusable_sentence: "Small slots beat random motivation.",
                source_item_ids: ["itm_1"],
              },
              {
                hook: "Hook patterns that increase saves",
                thesis: "Contrast common mistakes with one fix.",
                evidence_snippet: "User note about strong hooks.",
                tone: "direct",
                audience: "social creators",
                reusable_sentence: "Show the mistake before showing the method.",
                source_item_ids: ["itm_2"],
              },
            ];
          },
        },
      },
    });

    const result = await service.generate({
      goal: "inspire",
      dedupe_strength: "high",
      novelty: "balanced",
      count: 15,
      model: {
        provider: "mock",
        model: "demo-v1",
        temperature: 0.8,
      },
      filters: {
        days: 30,
      },
    });

    expect(result.atoms).toHaveLength(2);
    expect(result.stats.generated).toBe(3);
    expect(result.stats.after_dedupe).toBe(2);
    expect(result.atoms[0].source_item_ids.length).toBeGreaterThan(0);

    const atomsPath = path.join(tempDir, "atoms.jsonl");
    expect(fs.existsSync(atomsPath)).toBe(true);
    const lines = fs.readFileSync(atomsPath, "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);
    const persisted = JSON.parse(lines[0]);
    expect(persisted.run_id).toMatch(/^run_/);
    expect(persisted.atoms).toHaveLength(2);
  });

  it("routes request to selected provider", async () => {
    let seenModel = null;
    const service = createAtomService({
      inboxDir: tempDir,
      providerRegistry: {
        mock: {
          async generateAtoms({ model }) {
            seenModel = model;
            return [
              {
                hook: "A",
                thesis: "B",
                evidence_snippet: "C",
                tone: "neutral",
                audience: "creators",
                reusable_sentence: "D",
                source_item_ids: ["itm_1"],
              },
            ];
          },
        },
      },
    });

    await service.generate({
      goal: "reusable",
      dedupe_strength: "low",
      novelty: "safe",
      count: 5,
      model: {
        provider: "mock",
        model: "custom-model-name",
        temperature: 0.1,
      },
      filters: {},
    });

    expect(seenModel?.provider).toBe("mock");
    expect(seenModel?.model).toBe("custom-model-name");
  });
});
