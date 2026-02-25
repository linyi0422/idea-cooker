import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStorage } from "../src/storage.js";

describe("storage recovery", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "inbox-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("backs up broken index and rebuilds dedupe map from jsonl", async () => {
    const jsonlPath = path.join(tempDir, "items.jsonl");
    const indexPath = path.join(tempDir, "index.json");

    const existing = {
      id: "itm_old_1",
      url: "https://example.com/a",
      canonical_url: "https://example.com/a",
      title: "old",
      note: "old note",
      tags: [],
      source: "other",
      captured_at: new Date().toISOString(),
      client: "seed",
    };

    fs.writeFileSync(jsonlPath, `${JSON.stringify(existing)}\n`, "utf8");
    fs.writeFileSync(indexPath, "{broken-json", "utf8");

    const storage = createStorage({ inboxDir: tempDir });
    const result = await storage.saveItem(
      {
        url: "https://example.com/a?utm_source=test",
        title: "new",
        note: "new note value",
        tags: [],
        source: "other",
      },
      { client: "test" }
    );

    expect(result.deduplicated).toBe(true);

    const files = fs.readdirSync(tempDir);
    const backups = files.filter((file) => file.startsWith("index.json.bak."));
    expect(backups.length).toBe(1);
  });
});
