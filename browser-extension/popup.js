const DEFAULT_SETTINGS = {
  apiBaseUrl: "http://127.0.0.1:17832",
  inboxToken: "",
};

const SOURCE_MAP = {
  "xiaohongshu.com": "xhs",
  "douyin.com": "douyin",
  "x.com": "x",
  "twitter.com": "x",
  "mp.weixin.qq.com": "wechat",
};

const dom = {
  pageMeta: document.getElementById("pageMeta"),
  note: document.getElementById("note"),
  tags: document.getElementById("tags"),
  source: document.getElementById("source"),
  submitBtn: document.getElementById("submitBtn"),
  copyBtn: document.getElementById("copyBtn"),
  status: document.getElementById("status"),
};

let currentTab = null;
let fallbackPayload = null;

function setStatus(message, kind = "") {
  dom.status.textContent = message;
  dom.status.className = `status ${kind}`.trim();
}

function parseTags(raw) {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function detectSource(urlValue) {
  try {
    const hostname = new URL(urlValue).hostname;
    for (const [domain, source] of Object.entries(SOURCE_MAP)) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return source;
      }
    }
  } catch {
    return "other";
  }
  return "other";
}

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (data) => resolve(data));
  });
}

async function loadCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tabs[0] || null;
  if (!currentTab) {
    setStatus("No active tab found.", "error");
    dom.submitBtn.disabled = true;
    return;
  }

  const title = currentTab.title || "(untitled)";
  const shortUrl = (currentTab.url || "").slice(0, 60);
  dom.pageMeta.textContent = `${title} | ${shortUrl}`;
  dom.source.value = detectSource(currentTab.url || "");
}

async function submitCapture() {
  if (!currentTab?.url) {
    setStatus("Cannot read current page URL.", "error");
    return;
  }

  const note = dom.note.value.trim();
  if (note.length < 5) {
    setStatus("Note must be at least 5 characters.", "error");
    return;
  }

  const settings = await getSettings();
  if (!settings.inboxToken) {
    setStatus("Missing token. Open extension options and set inbox token.", "error");
    return;
  }

  const payload = {
    url: currentTab.url,
    title: currentTab.title || "(untitled)",
    note,
    tags: parseTags(dom.tags.value),
    source: dom.source.value,
  };

  dom.submitBtn.disabled = true;
  dom.copyBtn.hidden = true;
  setStatus("Submitting...", "");

  try {
    const response = await fetch(`${settings.apiBaseUrl}/api/v1/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Inbox-Token": settings.inboxToken,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    const suffix = data.deduplicated ? " (deduplicated)" : "";
    setStatus(`Saved: ${data.id}${suffix}`, "ok");
    fallbackPayload = null;
  } catch (error) {
    fallbackPayload = payload;
    dom.copyBtn.hidden = false;
    setStatus(`Save failed: ${error.message}. Use Copy JSON as fallback.`, "error");
  } finally {
    dom.submitBtn.disabled = false;
  }
}

async function copyFallback() {
  if (!fallbackPayload) {
    setStatus("No fallback payload available.", "error");
    return;
  }

  await navigator.clipboard.writeText(JSON.stringify(fallbackPayload, null, 2));
  setStatus("Fallback JSON copied.", "ok");
}

dom.submitBtn.addEventListener("click", submitCapture);
dom.copyBtn.addEventListener("click", () => {
  copyFallback().catch((error) => setStatus(`Copy failed: ${error.message}`, "error"));
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    submitCapture();
  }
});

loadCurrentTab().catch((error) => setStatus(`Init failed: ${error.message}`, "error"));
