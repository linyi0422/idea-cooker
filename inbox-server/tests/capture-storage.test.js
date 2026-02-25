import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("capture storage", () => {
  let tempDir;
  let app;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "inbox-test-"));
    app = createApp({ inboxToken: "test-token", inboxDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("writes one line to jsonl", async () => {
    const payload = {
      url: "https://example.com/post/123?utm_source=abc",
      title: "A title",
      note: "this item should be stored",
      tags: ["Narrative", "Hook"],
      source: "wechat",
    };

    const res = await request(app)
      .post("/api/v1/items")
      .set("X-Inbox-Token", "test-token")
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.id).toBe("string");

    const jsonlPath = path.join(tempDir, "items.jsonl");
    const lines = fs.readFileSync(jsonlPath, "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);

    const record = JSON.parse(lines[0]);
    expect(record.canonical_url).toBe("https://example.com/post/123");
    expect(record.tags).toEqual(["narrative", "hook"]);
  });

  it("returns deduplicated true on same canonical url", async () => {
    const payload = {
      url: "https://example.com/post/123?utm_source=abc",
      title: "A title",
      note: "this item should be stored",
      tags: ["tag"],
      source: "x",
    };

    await request(app)
      .post("/api/v1/items")
      .set("X-Inbox-Token", "test-token")
      .send(payload);

    const second = await request(app)
      .post("/api/v1/items")
      .set("X-Inbox-Token", "test-token")
      .send({ ...payload, note: "second note text" });

    expect(second.status).toBe(200);
    expect(second.body.deduplicated).toBe(true);
  });

  it("keeps both submissions in jsonl even when deduplicated", async () => {
    const payload = {
      url: "https://example.com/post/dup?utm_source=abc",
      title: "A title",
      note: "first note text",
      tags: ["tag"],
      source: "x",
    };

    await request(app)
      .post("/api/v1/items")
      .set("X-Inbox-Token", "test-token")
      .send(payload);

    await request(app)
      .post("/api/v1/items")
      .set("X-Inbox-Token", "test-token")
      .send({ ...payload, note: "second note text" });

    const jsonlPath = path.join(tempDir, "items.jsonl");
    const lines = fs.readFileSync(jsonlPath, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
  });
});
