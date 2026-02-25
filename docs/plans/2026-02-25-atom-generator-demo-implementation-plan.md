# Atom Generator Demo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a demo-ready inspiration atom generator with parameterized generation, provider switching, dedupe/rerank, and traceable atom persistence.

**Architecture:** Add a new `/api/v1/atoms/generate` endpoint plus a CLI command that uses the same service layer. The service reads source items from `inbox/items.jsonl`, calls a pluggable provider client, validates/normalizes atom output, deduplicates by strength, and writes runs to `inbox/atoms.jsonl`.

**Tech Stack:** Node.js (ESM), Express, Vitest, JSONL file storage.

---

### Task 1: Add failing tests for atom generation contract

**Files:**
- Create: `inbox-server/tests/atoms-api.test.js`
- Create: `inbox-server/tests/atoms-service.test.js`
- Create: `inbox-server/tests/atoms-cli.test.js`

**Step 1: Write failing tests**
1. API should return 200 with `run_id`, `atoms`, `stats`.
2. Service should dedupe similar atoms and keep source ids.
3. CLI should call service and print JSON.

**Step 2: Run tests to verify they fail**
Run: `npm test -- tests/atoms-api.test.js tests/atoms-service.test.js tests/atoms-cli.test.js`  
Expected: FAIL due to missing modules/routes/scripts.

### Task 2: Implement atom generation service and storage

**Files:**
- Create: `inbox-server/src/atoms-schema.js`
- Create: `inbox-server/src/items-reader.js`
- Create: `inbox-server/src/atoms-storage.js`
- Create: `inbox-server/src/provider-client.js`
- Create: `inbox-server/src/atoms-service.js`

**Step 1: Implement minimal code**
1. Parse/validate generation params.
2. Read source items from JSONL.
3. Call provider via interface.
4. Validate returned atoms and normalize.
5. Deduplicate by configurable threshold.
6. Persist run to `atoms.jsonl`.

**Step 2: Run task tests**
Run: `npm test -- tests/atoms-service.test.js tests/atoms-api.test.js`  
Expected: PASS.

### Task 3: Wire API + CLI + provider switch

**Files:**
- Modify: `inbox-server/src/app.js`
- Modify: `inbox-server/src/config.js`
- Modify: `inbox-server/package.json`
- Create: `inbox-server/src/cli-atoms.js`

**Step 1: Add route and command**
1. `POST /api/v1/atoms/generate`
2. `npm run atoms:generate -- ...`
3. model provider/model/temperature passthrough.

**Step 2: Run task tests**
Run: `npm test -- tests/atoms-api.test.js tests/atoms-cli.test.js`  
Expected: PASS.

### Task 4: Add smoke-test path and final verification

**Files:**
- Create: `inbox-server/tests/atoms-smoke.test.js`
- Modify: `inbox-server/README.md` (optional demo command section)

**Step 1: Add smoke test**
1. Skip unless required env vars exist.
2. Execute one real provider request and validate schema.

**Step 2: Full verification**
Run: `npm test`  
Expected: all mock tests pass; smoke test pass or skip clearly.
