import express from "express";
import { normalizeInput } from "./schema.js";
import { createStorage } from "./storage.js";
import { AtomServiceError, createAtomService } from "./atoms-service.js";

export function createApp(options = {}) {
  const app = express();
  const inboxToken = options.inboxToken ?? "";
  const storage = createStorage({ inboxDir: options.inboxDir });
  const atomService = createAtomService({
    inboxDir: options.inboxDir,
    providerRegistry: options.providerRegistry,
  });

  app.use(express.json({ limit: "256kb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.post("/api/v1/items", async (req, res) => {
    const token = req.get("X-Inbox-Token");
    if (!token || token !== inboxToken) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const parsed = normalizeInput(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_PAYLOAD",
        details: parsed.details,
      });
    }

    try {
      const result = await storage.saveItem(parsed.data, { client: "extension" });
      return res.status(200).json({
        ok: true,
        id: result.id,
        deduplicated: result.deduplicated,
      });
    } catch {
      return res.status(500).json({
        ok: false,
        error: "STORAGE_WRITE_FAILED",
      });
    }
  });

  app.post("/api/v1/atoms/generate", async (req, res) => {
    const token = req.get("X-Inbox-Token");
    if (!token || token !== inboxToken) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    try {
      const result = await atomService.generate(req.body);
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof AtomServiceError) {
        const status = error.code === "INVALID_PROVIDER" || error.code === "INVALID_PARAMS" ? 400 : 422;
        return res.status(status).json({
          ok: false,
          error: error.code,
          message: error.message,
          details: error.details ?? [],
        });
      }

      return res.status(500).json({
        ok: false,
        error: "ATOM_GENERATION_FAILED",
      });
    }
  });

  return app;
}
