import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runAtomsCli } from "../src/cli-atoms.js";

describe("atoms cli", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "atoms-cli-test-"));
    const now = new Date().toISOString();
    const lines = [
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
    ]
      .map((item) => JSON.stringify(item))
      .join("\n");
    fs.writeFileSync(path.join(tempDir, "items.jsonl"), `${lines}\n`, "utf8");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("generates atoms via CLI with mock provider", async () => {
    let captured = "";
    const exitCode = await runAtomsCli(
      [
        "--inbox-dir",
        tempDir,
        "--goal",
        "inspire",
        "--dedupe-strength",
        "medium",
        "--novelty",
        "balanced",
        "--count",
        "5",
        "--provider",
        "mock",
        "--model",
        "demo-v1",
        "--temperature",
        "0.7",
        "--days",
        "30",
      ],
      {
        stdout: {
          write(text) {
            captured += text;
          },
        },
        stderr: {
          write() {},
        },
      }
    );

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(captured.trim());
    expect(parsed.ok).toBe(true);
    expect(parsed.run_id).toMatch(/^run_/);
    expect(Array.isArray(parsed.atoms)).toBe(true);
    expect(parsed.atoms.length).toBeGreaterThan(0);
    expect(parsed.atoms[0].source_item_ids.length).toBeGreaterThan(0);
  });

  it("returns non-zero for invalid provider", async () => {
    let capturedErr = "";
    const exitCode = await runAtomsCli(
      [
        "--inbox-dir",
        tempDir,
        "--goal",
        "inspire",
        "--dedupe-strength",
        "medium",
        "--novelty",
        "balanced",
        "--provider",
        "nope",
      ],
      {
        stdout: {
          write() {},
        },
        stderr: {
          write(text) {
            capturedErr += text;
          },
        },
      }
    );

    expect(exitCode).toBe(1);
    expect(capturedErr).toContain("INVALID_PROVIDER");
  });
});
