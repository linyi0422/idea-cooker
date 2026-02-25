import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("capture auth", () => {
  let tempDir;
  let app;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "inbox-test-"));
    app = createApp({ inboxToken: "test-token", inboxDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("rejects request without token", async () => {
    const res = await request(app).post("/api/v1/items").send({
      url: "https://example.com/a",
      title: "title",
      note: "valid note",
      tags: ["tag1"],
      source: "x",
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("UNAUTHORIZED");
  });

  it("rejects request with mismatched token", async () => {
    const res = await request(app)
      .post("/api/v1/items")
      .set("X-Inbox-Token", "wrong-token")
      .send({
        url: "https://example.com/a",
        title: "title",
        note: "valid note",
        tags: ["tag1"],
        source: "x",
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("UNAUTHORIZED");
  });
});
