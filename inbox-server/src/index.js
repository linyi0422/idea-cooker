import "dotenv/config";
import { createApp } from "./app.js";
import { readConfig } from "./config.js";

const config = readConfig();

if (!config.inboxToken) {
  console.error("INBOX_TOKEN is required. Copy .env.example to .env and set token.");
  process.exit(1);
}

const app = createApp({
  inboxToken: config.inboxToken,
  inboxDir: config.inboxDir,
});

app.listen(config.port, config.host, () => {
  console.log(
    `[inbox-server] listening on http://${config.host}:${config.port}, inboxDir=${config.inboxDir}`
  );
});
