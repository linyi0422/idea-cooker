import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAtomService, AtomServiceError } from "./atoms-service.js";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) {
      continue;
    }
    const normalizedKey = key.slice(2);
    const value = argv[i + 1];
    if (typeof value === "undefined" || value.startsWith("--")) {
      args[normalizedKey] = true;
      continue;
    }
    args[normalizedKey] = value;
    i += 1;
  }
  return args;
}

function buildPayload(args) {
  return {
    goal: args.goal ?? "inspire",
    dedupe_strength: args["dedupe-strength"] ?? "medium",
    novelty: args.novelty ?? "balanced",
    count: Number(args.count ?? 15),
    filters: {
      days: args.days ? Number(args.days) : 30,
      tags: args.tags
        ? String(args.tags)
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : [],
      sources: args.sources
        ? String(args.sources)
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : [],
    },
    model: {
      provider: args.provider ?? "mock",
      model: args.model ?? "demo-v1",
      temperature: Number(args.temperature ?? 0.7),
    },
  };
}

export async function runAtomsCli(
  argv,
  io = { stdout: process.stdout, stderr: process.stderr }
) {
  const args = parseArgs(argv);
  const inboxDir = args["inbox-dir"]
    ? path.resolve(args["inbox-dir"])
    : path.resolve(process.cwd(), "../inbox");
  const payload = buildPayload(args);
  const service = createAtomService({ inboxDir });

  try {
    const result = await service.generate(payload);
    io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    const response =
      error instanceof AtomServiceError
        ? {
            ok: false,
            error: error.code,
            message: error.message,
            details: error.details ?? [],
          }
        : {
            ok: false,
            error: "ATOM_GENERATION_FAILED",
            message: error.message ?? "Unknown error",
          };
    io.stderr.write(`${JSON.stringify(response, null, 2)}\n`);
    return 1;
  }
}

const entryPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === entryPath) {
  runAtomsCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
