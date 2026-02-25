# Extension MVP Checklist

1. Open popup and it shows current page title and URL fragment.
2. Enter valid `note` and optional `tags`.
3. Submit capture and receive success status in popup.
4. `inbox/items.jsonl` gets one new line.
5. Submit same URL again and response indicates deduplicated capture.
6. Stop server and submit again; popup shows fallback error and `Copy JSON` button.
