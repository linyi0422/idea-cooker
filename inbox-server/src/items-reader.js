import fs from "node:fs/promises";
import path from "node:path";

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function withinDays(capturedAt, maxDays) {
  if (!maxDays) {
    return true;
  }
  const ts = Date.parse(capturedAt);
  if (Number.isNaN(ts)) {
    return false;
  }
  const now = Date.now();
  const diffDays = (now - ts) / (1000 * 60 * 60 * 24);
  return diffDays <= maxDays;
}

function matchesTags(item, tags) {
  if (!tags || tags.length === 0) {
    return true;
  }
  const itemTags = (item.tags ?? []).map((value) => String(value).toLowerCase());
  return tags.some((tag) => itemTags.includes(tag));
}

function matchesSources(item, sources) {
  if (!sources || sources.length === 0) {
    return true;
  }
  return sources.includes(item.source);
}

export async function readItemsForAtoms({ inboxDir, filters = {} }) {
  const jsonlPath = path.join(inboxDir, "items.jsonl");
  if (!(await pathExists(jsonlPath))) {
    return [];
  }

  const raw = await fs.readFile(jsonlPath, "utf8");
  const tags = (filters.tags ?? []).map((tag) => String(tag).toLowerCase());
  const sources = filters.sources ?? [];
  const days = filters.days;

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((item) => withinDays(item.captured_at, days))
    .filter((item) => matchesTags(item, tags))
    .filter((item) => matchesSources(item, sources));
}
