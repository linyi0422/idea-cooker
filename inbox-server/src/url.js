export function canonicalize(inputUrl) {
  const url = new URL(inputUrl);
  const blocked = new Set(["spm", "from", "si"]);

  for (const key of [...url.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (lower.startsWith("utm_") || blocked.has(lower)) {
      url.searchParams.delete(key);
    }
  }

  url.hash = "";
  url.searchParams.sort();
  const query = url.searchParams.toString();
  return `${url.origin}${url.pathname}${query ? `?${query}` : ""}`;
}
