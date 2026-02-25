# Local Capture Runbook

## 1. Start inbox-server

1. `cd inbox-server`
2. `Copy-Item .env.example .env`
3. Open `.env`, set `INBOX_TOKEN` to a non-empty value.
4. `npm install`
5. `npm start`
6. Confirm server health:
   - `Invoke-RestMethod http://127.0.0.1:17832/health`
   - expected: `{ ok = True }`

## 2. Load browser extension

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select folder: `c:\Jupyter notes\Creator\browser-extension`.

## 3. Configure extension options

1. Click extension details, open `Extension options`.
2. Set:
   - `API Base URL`: `http://127.0.0.1:17832`
   - `Inbox Token`: same value as `.env` `INBOX_TOKEN`
3. Click `Save`.

## 4. Run one capture

1. Open any web page.
2. Click extension icon.
3. Enter:
   - `Note`: at least 5 characters
   - `Tags`: optional comma-separated values
   - `Source`: choose one option
4. Click `Save to Inbox`.
5. Expected popup status:
   - `Saved: itm_...`
6. Verify local storage:
   - `Get-Content ../inbox/items.jsonl | Select-Object -Last 1`

## 5. Verify dedupe signal

1. Capture same page URL again with another note.
2. Expected popup status includes `(deduplicated)`.

## 6. Fallback path when server is offline

1. Stop server process.
2. Try capture in popup.
3. Expected:
   - error status
   - `Copy JSON` button shown
4. Click `Copy JSON`, paste into text editor, keep as temporary backup.

## 7. Common errors

1. `UNAUTHORIZED`:
   - token mismatch between extension and `.env`.
2. Connection failed:
   - server not running or wrong port.
3. `INVALID_PAYLOAD`:
   - missing `source` or note too short.
4. `STORAGE_WRITE_FAILED`:
   - no write permission on `inbox/`.
