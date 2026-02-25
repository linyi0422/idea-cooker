import path from "node:path";

export function readConfig(overrides = {}) {
  const port = Number(overrides.port ?? process.env.PORT ?? 17832);
  const host = overrides.host ?? process.env.HOST ?? "127.0.0.1";
  const inboxToken = overrides.inboxToken ?? process.env.INBOX_TOKEN ?? "";
  const inboxDir = path.resolve(
    process.cwd(),
    overrides.inboxDir ?? process.env.INBOX_DIR ?? "../inbox"
  );

  return { port, host, inboxToken, inboxDir };
}
