import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { canonicalize } from "./url.js";

let writeLock = Promise.resolve();

function utcDate() {
  const now = new Date();
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}${String(now.getUTCDate()).padStart(2, "0")}`;
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function rebuildIndex(jsonlPath) {
  const index = {};
  if (!(await pathExists(jsonlPath))) {
    return index;
  }

  const raw = await fs.readFile(jsonlPath, "utf8");
  const lines = raw.split("\n");
  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    try {
      const record = JSON.parse(line);
      if (record.canonical_url && record.id) {
        index[record.canonical_url] = record.id;
      }
    } catch {
      // Skip malformed lines when rebuilding.
    }
  }
  return index;
}

async function safeReadIndex(indexPath, jsonlPath) {
  if (!(await pathExists(indexPath))) {
    return {};
  }

  try {
    const raw = await fs.readFile(indexPath, "utf8");
    return JSON.parse(raw);
  } catch {
    const backupPath = `${indexPath}.bak.${Date.now()}`;
    await fs.copyFile(indexPath, backupPath);
    return rebuildIndex(jsonlPath);
  }
}

export function createStorage({ inboxDir }) {
  const jsonlPath = path.join(inboxDir, "items.jsonl");
  const indexPath = path.join(inboxDir, "index.json");

  return {
    async saveItem(input, { client }) {
      const previousWrite = writeLock;
      let releaseLock;
      writeLock = new Promise((resolve) => {
        releaseLock = resolve;
      });

      await previousWrite;

      try {
        await fs.mkdir(inboxDir, { recursive: true });

        const canonicalUrl = canonicalize(input.url);
        const index = await safeReadIndex(indexPath, jsonlPath);
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

        await fs.appendFile(jsonlPath, `${JSON.stringify(record)}\n`, "utf8");
        index[canonicalUrl] = id;
        await fs.writeFile(indexPath, JSON.stringify(index, null, 2), "utf8");

        return { id, deduplicated };
      } finally {
        releaseLock();
      }
    },
  };
}
