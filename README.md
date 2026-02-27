<<<<<<< HEAD
# Content Agent

Local-first capture + inspiration generator for creators.

Capture ideas from any browser page, store them in a structured inbox, then turn them into reusable content atoms with configurable "cooking" parameters.

## Why This Project

1. Fast capture loop: browser extension to local inbox.
2. Local-first storage: append-only JSONL records you can inspect.
3. Inspiration engine demo: generate content atoms from your own material.
4. Testable by default: unit/integration tests plus optional real-model smoke test.

## Features

1. Browser capture (`url/title/note/tags/source`) via Chrome/Edge extension.
2. Authenticated local API (`X-Inbox-Token`) for capture ingestion.
3. URL canonicalization + dedupe signal.
4. Atom generation with flexible parameters:
   - `goal`: `inspire | publishable | reusable`
   - `dedupe_strength`: `low | medium | high`
   - `novelty`: `safe | balanced | bold`
5. Multi-provider model routing (`mock` for demo/tests, `openai` for real calls).
6. Traceable output (`source_item_ids`) persisted to `inbox/atoms.jsonl`.

## 3-Minute Quickstart

```bash
cd inbox-server
npm install
Copy-Item .env.example .env
# edit .env and set INBOX_TOKEN
npm start
```

In another terminal:

```bash
cd inbox-server
npm run atoms:generate -- --inbox-dir ../inbox --goal inspire --dedupe-strength medium --novelty balanced --count 15 --provider mock --model demo-v1 --temperature 0.7 --days 30
```

## API

### Capture Item

- `POST /api/v1/items`
- Header: `X-Inbox-Token: <token>`

### Generate Atoms

- `POST /api/v1/atoms/generate`
- Header: `X-Inbox-Token: <token>`
- Example body:

```json
{
  "goal": "inspire",
  "dedupe_strength": "medium",
  "novelty": "balanced",
  "count": 15,
  "filters": { "days": 30 },
  "model": { "provider": "mock", "model": "demo-v1", "temperature": 0.7 }
}
```

## Project Structure

```text
browser-extension/   # Chrome/Edge extension UI
inbox-server/        # Node.js API + generator service + tests
inbox/               # Local runtime storage (JSONL)
docs/                # Plans, checklists, runbooks
```

## Testing

```bash
cd inbox-server
npm test
```

- Default test path uses mock provider.
- Real OpenAI smoke test runs only when both `OPENAI_API_KEY` and `OPENAI_MODEL` are set.

## Security Notes

1. Do not commit `.env` or real tokens.
2. Rotate `INBOX_TOKEN` before public demo/deployment.
3. Keep local server bound to `127.0.0.1` for local-only access.

## License

MIT. See [LICENSE](./LICENSE).
=======
# idea-cooker
>>>>>>> 384f143dadbf466f112797136308d0fd91509c84
