import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

function seedItems(tempDir) {
  const now = new Date().toISOString();
  const payload = [
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
  ];
  fs.writeFileSync(
    path.join(tempDir, "items.jsonl"),
    `${payload.map((item) => JSON.stringify(item)).join("\n")}\n`,
    "utf8"
  );
}

describe("atoms api", () => {
  let tempDir;
  let app;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "atoms-api-test-"));
    seedItems(tempDir);
    app = createApp({
      inboxToken: "test-token",
      inboxDir: tempDir,
      providerRegistry: {
        mock: {
          async generateAtoms() {
            return [
              {
                hook: "How to keep writing every day",
                thesis: "Use small repeatable slots.",
                evidence_snippet: "Based on captured writing note.",
                tone: "practical",
                audience: "creators",
                reusable_sentence: "Small slots beat random motivation.",
                source_item_ids: ["itm_1"],
              },
            ];
          },
        },
      },
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("generates atoms with valid payload", async () => {
    const res = await request(app)
      .post("/api/v1/atoms/generate")
      .set("X-Inbox-Token", "test-token")
      .send({
        goal: "inspire",
        dedupe_strength: "medium",
        novelty: "balanced",
        count: 15,
        filters: { days: 30 },
        model: {
          provider: "mock",
          model: "demo-v1",
          temperature: 0.7,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.run_id).toMatch(/^run_/);
    expect(Array.isArray(res.body.atoms)).toBe(true);
    expect(res.body.atoms[0].reusable_sentence.length).toBeGreaterThan(0);
    expect(res.body.stats.generated).toBeGreaterThan(0);
  });

  it("rejects unsupported provider", async () => {
    const res = await request(app)
      .post("/api/v1/atoms/generate")
      .set("X-Inbox-Token", "test-token")
      .send({
        goal: "inspire",
        dedupe_strength: "medium",
        novelty: "balanced",
        count: 15,
        filters: { days: 30 },
        model: {
          provider: "unknown-provider",
          model: "x",
          temperature: 0.7,
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("INVALID_PROVIDER");
  });
});
