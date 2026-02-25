# Launch Post Draft

## One-Liner

Built a local-first content capture + inspiration generator: collect ideas from browser pages, then "cook" them into reusable content atoms with configurable parameters.

## Short Version (X / Threads)

Open-sourced my `Content Agent` demo.

What it does:
1. Capture web inspiration via browser extension
2. Save locally as structured inbox data
3. Generate reusable content atoms with controllable params (`goal`, `dedupe`, `novelty`)

Runs fully local-first with API + CLI.
Repo: `<YOUR_GITHUB_REPO_URL>`

## Long Version (Reddit / Hacker News / Blog)

I just open-sourced a small local-first project called **Content Agent**.

The workflow:
1. Capture ideas while browsing (`url/title/note/tags/source`)
2. Store everything in local JSONL inbox files
3. Generate "content atoms" from your own material

What I wanted:
1. Fast capture loop
2. Traceable generation output
3. Parameterized creativity instead of one-click black box

Current demo supports:
1. `goal`: inspire / publishable / reusable
2. `dedupe_strength`: low / medium / high
3. `novelty`: safe / balanced / bold
4. multi-provider model routing (`mock` + `openai`)

Would love feedback on:
1. Most useful next feature
2. Better atom schema fields
3. Evaluation ideas for generation quality

Repo: `<YOUR_GITHUB_REPO_URL>`
