import fs from "node:fs/promises";
import path from "node:path";

let atomsWriteLock = Promise.resolve();

export function createAtomsStorage({ inboxDir }) {
  const atomsPath = path.join(inboxDir, "atoms.jsonl");

  return {
    async saveRun(runRecord) {
      const previous = atomsWriteLock;
      let release;
      atomsWriteLock = new Promise((resolve) => {
        release = resolve;
      });
      await previous;

      try {
        await fs.mkdir(inboxDir, { recursive: true });
        await fs.appendFile(atomsPath, `${JSON.stringify(runRecord)}\n`, "utf8");
      } finally {
        release();
      }
    },
  };
}
