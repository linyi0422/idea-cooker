# Contributing

Thanks for your interest in improving Content Agent.

## Development Setup

1. `cd inbox-server`
2. `npm install`
3. `Copy-Item .env.example .env`
4. Set `INBOX_TOKEN` in `.env`

## Run Tests

```bash
cd inbox-server
npm test
```

## Scope Guidelines

1. Keep changes small and focused.
2. Add or update tests for behavior changes.
3. Keep local-first assumptions unless explicitly discussing remote mode.

## Pull Request Checklist

1. Tests pass locally.
2. No secrets or local runtime data included.
3. README/docs updated if user-facing behavior changed.
