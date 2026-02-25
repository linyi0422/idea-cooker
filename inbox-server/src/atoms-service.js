import crypto from "node:crypto";
import { createAtomsStorage } from "./atoms-storage.js";
import {
  normalizeAtomGenerationRequest,
  normalizeGeneratedAtoms,
} from "./atoms-schema.js";
import { readItemsForAtoms } from "./items-reader.js";
import {
  createDefaultProviderRegistry,
  getProviderClient,
} from "./provider-client.js";

class AtomServiceError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function utcDate() {
  const now = new Date();
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}${String(now.getUTCDate()).padStart(2, "0")}`;
}

function normalizeForSimilarity(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function jaccardSimilarity(aText, bText) {
  const aSet = new Set(normalizeForSimilarity(aText));
  const bSet = new Set(normalizeForSimilarity(bText));
  if (aSet.size === 0 && bSet.size === 0) {
    return 1;
  }
  let intersection = 0;
  for (const token of aSet) {
    if (bSet.has(token)) {
      intersection += 1;
    }
  }
  const union = new Set([...aSet, ...bSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function dedupeThreshold(strength) {
  if (strength === "high") {
    return 0.55;
  }
  if (strength === "medium") {
    return 0.72;
  }
  return 0.88;
}

function dedupeAndLimit(atoms, strength, count) {
  const threshold = dedupeThreshold(strength);
  const result = [];
  for (const atom of atoms) {
    const signature = `${atom.hook} ${atom.thesis} ${atom.reusable_sentence}`;
    const duplicated = result.some((existing) => {
      const other = `${existing.hook} ${existing.thesis} ${existing.reusable_sentence}`;
      return jaccardSimilarity(signature, other) >= threshold;
    });
    if (duplicated) {
      continue;
    }
    result.push(atom);
    if (result.length >= count) {
      break;
    }
  }
  return result;
}

function enrichAtoms(atoms, params) {
  const now = new Date().toISOString();
  return atoms.map((atom) => ({
    atom_id: `atm_${utcDate()}_${crypto.randomBytes(4).toString("hex")}`,
    ...atom,
    novelty_level: params.novelty,
    created_at: now,
  }));
}

export function createAtomService({ inboxDir, providerRegistry } = {}) {
  const storage = createAtomsStorage({ inboxDir });
  const registry = providerRegistry ?? createDefaultProviderRegistry();

  return {
    async generate(rawParams) {
      const parsedParams = normalizeAtomGenerationRequest(rawParams);
      if (!parsedParams.ok) {
        throw new AtomServiceError(
          "INVALID_PARAMS",
          "Invalid generation parameters.",
          parsedParams.details
        );
      }
      const params = parsedParams.data;

      const providerClient = getProviderClient(params.model.provider, registry);
      if (!providerClient) {
        throw new AtomServiceError(
          "INVALID_PROVIDER",
          `Unsupported provider: ${params.model.provider}`
        );
      }

      const items = await readItemsForAtoms({ inboxDir, filters: params.filters });
      if (items.length === 0) {
        throw new AtomServiceError("NO_SOURCE_ITEMS", "No source items match filters.");
      }

      let providerAtoms;
      try {
        providerAtoms = await providerClient.generateAtoms({
          items,
          params,
          model: params.model,
        });
      } catch (error) {
        throw new AtomServiceError(
          error.code ?? "PROVIDER_ERROR",
          error.message ?? "Provider call failed."
        );
      }

      const parsedAtoms = normalizeGeneratedAtoms(providerAtoms);
      if (!parsedAtoms.ok) {
        throw new AtomServiceError(
          "INVALID_MODEL_OUTPUT",
          "Provider output does not match atom schema.",
          parsedAtoms.details
        );
      }

      const deduped = dedupeAndLimit(
        parsedAtoms.data,
        params.dedupe_strength,
        params.count
      );
      const atoms = enrichAtoms(deduped, params);
      const runId = `run_${utcDate()}_${crypto.randomBytes(3).toString("hex")}`;
      const createdAt = new Date().toISOString();

      const runRecord = {
        run_id: runId,
        created_at: createdAt,
        params,
        atoms,
        stats: {
          input_items: items.length,
          generated: parsedAtoms.data.length,
          after_dedupe: atoms.length,
        },
      };
      await storage.saveRun(runRecord);

      return {
        ok: true,
        run_id: runId,
        created_at: createdAt,
        atoms,
        stats: runRecord.stats,
      };
    },
  };
}

export { AtomServiceError };
