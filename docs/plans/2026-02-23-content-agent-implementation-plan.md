# Content Agent MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local-first capture pipeline: browser extension collects `url/title/note/tags` and writes to local inbox storage.

**Architecture:** A Manifest v3 browser extension sends authenticated POST requests to a localhost Node.js API. The API validates payloads, normalizes URLs, generates IDs, appends JSONL records, and tracks basic dedup via index file.

**Tech Stack:** Node.js 20+, Express, Zod, Vitest, Supertest, Chrome/Edge Extension (Manifest v3)

---

## Preconditions

1. Install Node.js 20+.
2. Open project root: `c:\Jupyter notes\Creator`.
3. Create `.env` from `.env.example` before running server.

## Test Isolation Rules (apply to Task 2 and Task 3)

1. Use a temp directory for each test: `fs.mkdtempSync(path.join(os.tmpdir(), "inbox-test-"))`.
2. Create temp storage in `beforeEach`; remove it in `afterEach` with `fs.rmSync(dir, { recursive: true, force: true })`.
3. Inject storage path and token via `createApp({ inboxDir, inboxToken })`; do not hardcode `inbox/` in tests.
4. Keep tests hermetic: each test must assert only files created in its own temp directory.

### Task 1: Scaffold server project

**Files:**
- Create: `inbox-server/package.json`
- Create: `inbox-server/src/index.js`
- Create: `inbox-server/src/app.js`
- Create: `inbox-server/src/config.js`
- Create: `inbox-server/.env.example`
- Create: `inbox-server/.gitignore`

**Step 1: Write the failing test**

```js
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("health", () => {
  it("returns ok", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/health.test.js`  
Expected: FAIL (missing app export)

**Step 3: Write minimal implementation**

```js
import express from "express";

export function createApp() {
  const app = express();
  app.get("/health", (_req, res) => res.json({ ok: true }));
  return app;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/health.test.js`  
Expected: PASS

**Step 5: Commit**

```bash
git add inbox-server
git commit -m "chore: scaffold inbox server with health endpoint"
```

### Task 2: Implement authenticated capture endpoint

**Files:**
- Modify: `inbox-server/src/app.js`
- Create: `inbox-server/src/schema.js`
- Create: `inbox-server/src/storage.js`
- Create: `inbox-server/tests/capture-auth.test.js`
- Create: `inbox-server/tests/capture-validation.test.js`
- Modify: `inbox-server/src/index.js`

**Step 1: Write the failing tests**

```js
// inbox-server/tests/capture-auth.test.js
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
});
```

```js
// inbox-server/tests/capture-validation.test.js
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
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test -- --run tests/capture-auth.test.js tests/capture-validation.test.js`  
Expected: FAIL (route/schema/storage not implemented)

**Step 3: Write minimal implementation**

```js
// inbox-server/src/schema.js
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
```

```js
// inbox-server/src/app.js
import express from "express";
import { normalizeInput } from "./schema.js";
import { createStorage } from "./storage.js";

export function createApp(options = {}) {
  const app = express();
  const inboxToken = options.inboxToken ?? process.env.INBOX_TOKEN ?? "";
  const storage = createStorage({ inboxDir: options.inboxDir });

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.post("/api/v1/items", async (req, res) => {
    const token = req.get("X-Inbox-Token");
    if (!token || token !== inboxToken) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const parsed = normalizeInput(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_PAYLOAD",
        details: parsed.details,
      });
    }

    try {
      const result = await storage.saveItem(parsed.data, { client: "extension" });
      return res.status(200).json({
        ok: true,
        id: result.id,
        deduplicated: result.deduplicated,
      });
    } catch {
      return res.status(500).json({
        ok: false,
        error: "STORAGE_WRITE_FAILED",
      });
    }
  });

  return app;
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test -- --run tests/capture-auth.test.js tests/capture-validation.test.js`  
Expected: PASS

**Step 5: Commit**

```bash
git add inbox-server/src inbox-server/tests
git commit -m "feat: add authenticated capture endpoint with validation"
```

### Task 3: Add URL canonicalization and JSONL persistence

**Files:**
- Create: `inbox-server/src/url.js`
- Modify: `inbox-server/src/storage.js`
- Create: `inbox-server/tests/url.test.js`
- Create: `inbox-server/tests/capture-storage.test.js`
- Create: `inbox/items.jsonl` (runtime)
- Create: `inbox/index.json` (runtime)

**Step 1: Write the failing tests**

```js
// inbox-server/tests/url.test.js
import { describe, it, expect } from "vitest";
import { canonicalize } from "../src/url.js";

describe("canonicalize", () => {
  it("removes tracking params and hash", () => {
    expect(canonicalize("https://a.com/p?utm_source=1&x=2#intro")).toBe("https://a.com/p?x=2");
  });
});
```

```js
// inbox-server/tests/capture-storage.test.js
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
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test -- --run tests/url.test.js tests/capture-storage.test.js`  
Expected: FAIL (canonicalize/storage missing)

**Step 3: Write minimal implementation**

```js
// inbox-server/src/url.js
export function canonicalize(inputUrl) {
  const url = new URL(inputUrl);
  const blocked = new Set(["spm", "from", "source", "si"]);

  for (const key of [...url.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (lower.startsWith("utm_") || blocked.has(lower)) {
      url.searchParams.delete(key);
    }
  }

  url.hash = "";
  const query = url.searchParams.toString();
  return `${url.origin}${url.pathname}${query ? `?${query}` : ""}`;
}
```

```js
// inbox-server/src/storage.js
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { canonicalize } from "./url.js";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function utcDate() {
  const now = new Date();
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
}

export function createStorage({ inboxDir = path.resolve(process.cwd(), "../inbox") } = {}) {
  ensureDir(inboxDir);
  const jsonlPath = path.join(inboxDir, "items.jsonl");
  const indexPath = path.join(inboxDir, "index.json");

  return {
    async saveItem(input, { client }) {
      const canonicalUrl = canonicalize(input.url);
      let index = {};

      try {
        if (fs.existsSync(indexPath)) {
          index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
        }
      } catch {
        index = {};
      }

      const deduplicated = Boolean(index[canonicalUrl]);
      const id = `itm_${utcDate()}_${crypto.randomBytes(4).toString("hex")}`;
      const record = {
        id,
        url: input.url,
        canonical_url: canonicalUrl,
        title: input.title,
        note: input.note,
        tags: input.tags ?? [],
        source: input.source,
        captured_at: new Date().toISOString(),
        client,
      };

      fs.appendFileSync(jsonlPath, `${JSON.stringify(record)}\n`, "utf8");
      index[canonicalUrl] = id;
      fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf8");

      return { id, deduplicated };
    },
  };
}
```

Storage behavior:
1. Generate ID: `itm_YYYYMMDD_<8hex>`
2. Append JSON string + newline to `inbox/items.jsonl`
3. Upsert `inbox/index.json` with `canonical_url -> id`
4. Response includes `{ ok, id, deduplicated }`

**Step 4: Run tests to verify they pass**

Run: `npm run test -- --run tests/url.test.js tests/capture-storage.test.js`  
Expected: PASS

**Step 5: Commit**

```bash
git add inbox-server/src inbox-server/tests inbox
git commit -m "feat: add canonicalization and jsonl persistence"
```

### Task 4: Build browser extension popup capture flow

**Files:**
- Create: `browser-extension/manifest.json`
- Create: `browser-extension/popup.html`
- Create: `browser-extension/popup.css`
- Create: `browser-extension/popup.js`
- Create: `browser-extension/service-worker.js`
- Create: `browser-extension/options.html`
- Create: `browser-extension/options.js`

**Step 1: Write manual acceptance checklist (failing by default)**

`docs/checklists/extension-mvp-checklist.md`:
1. Open popup and auto-read current page title/url
2. Enter note and optional tags
3. Submit success toast appears
4. `inbox/items.jsonl` contains new line
5. Server offline shows fallback copy-json action

**Step 2: Verify checklist fails (before implementation)**

1. Start server: `cd inbox-server && node src/index.js`
2. Open `chrome://extensions` and enable Developer mode.
3. Click `Load unpacked` and select `browser-extension/`.
4. Open any page and click extension icon.
5. Expected fail state before implementation:
   - popup has no working submit flow,
   - no success toast,
   - `inbox/items.jsonl` unchanged,
   - no copy-json fallback.

**Step 3: Write minimal implementation**

Popup fields:
- `note` required
- `tags` optional (comma split)

Storage:
- `chrome.storage.sync` for `apiBaseUrl` and `token`

Submit:
- Fetch `POST /api/v1/items`
- Render success/error state
- Fallback button copies JSON payload to clipboard

**Step 4: Run manual checklist again**

Expected: items 1-5 pass.

**Step 5: Commit**

```bash
git add browser-extension docs/checklists
git commit -m "feat: add extension popup capture flow"
```

### Task 5: Add developer docs and runbook

**Files:**
- Create: `README.md`
- Create: `docs/runbooks/local-capture.md`
- Modify: `docs/plans/2026-02-23-content-agent-mvp-design.md`

**Step 1: Write failing doc checklist**

`docs/checklists/docs-completeness.md`:
1. New user can start server in under 5 minutes
2. New user can load extension in developer mode
3. New user can submit one capture successfully
4. Troubleshooting section covers token and CORS issues

**Step 2: Verify checklist fails**

Read docs and confirm missing instructions.

**Step 3: Write minimal docs**

README must include:
1. project purpose
2. directory map
3. quickstart commands

Runbook must include:
1. start server
2. configure token/base URL in extension
3. capture flow test
4. common errors and fixes

**Step 4: Verify checklist passes**

Use a clean terminal and validate from scratch:
1. `git clone <repo>` into a new directory.
2. Follow only `README.md` quickstart.
3. Follow `docs/runbooks/local-capture.md` and complete one capture.
4. Record each checklist item as pass/fail with timestamp.
5. If any item fails, update docs and rerun.

**Step 5: Commit**

```bash
git add README.md docs
git commit -m "docs: add setup guide and local capture runbook"
```

## Verification Commands

1. `cd inbox-server && npm install`
2. `cd inbox-server && npm run test`
3. `node -e "JSON.parse(require('fs').readFileSync('../inbox/items.jsonl','utf8').trim().split('\n').slice(-1)[0])"`
4. Manual extension capture checklist

## Definition of Done

1. Extension can submit valid captures end-to-end.
2. API validates auth and payload correctly.
3. Data persists in `inbox/items.jsonl` with canonicalized URLs.
4. Dedupe signal is returned in API response.
5. Setup docs allow repeatable local run by another person.

## Risks and Mitigations

1. Browser permission issues: keep minimal permission set and document load steps.
2. Token leakage: keep token in local config only; never log token.
3. Data corruption in JSONL: append atomically and add malformed-line guard on read.
4. Platform URL variants: maintain tested canonicalization rules and update via tests.

Plan complete and saved to `docs/plans/2026-02-23-content-agent-implementation-plan.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

Which approach?
