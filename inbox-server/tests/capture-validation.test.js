import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("capture validation", () => {
  let tempDir;
  let app;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "inbox-test-"));
    app = createApp({ inboxToken: "test-token", inboxDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("rejects invalid payload", async () => {
    const res = await request(app)
      .post("/api/v1/items")
      .set("X-Inbox-Token", "test-token")
      .send({ title: "only title" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("INVALID_PAYLOAD");
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it("accepts note with exact lower bound length", async () => {
    const res = await request(app)
      .post("/api/v1/items")
      .set("X-Inbox-Token", "test-token")
      .send({
        url: "https://example.com/lower-bound",
        title: "lower",
        note: "12345",
        tags: [],
        source: "other",
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("accepts note with exact upper bound length", async () => {
    const res = await request(app)
      .post("/api/v1/items")
      .set("X-Inbox-Token", "test-token")
      .send({
        url: "https://example.com/upper-bound",
        title: "upper",
        note: "a".repeat(280),
        tags: [],
        source: "other",
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
