import fs from "node:fs";
import path from "node:path";

/**
 * Synchronous filesystem lock for short critical sections in the local,
 * single-host JSON storage mode. Atomic mkdir coordinates processes that
 * share the same filesystem; it cannot coordinate separate hosts/containers.
 */
export function withFileLock<T>(
  lockPath: string,
  operation: () => T,
  timeoutMs = 5_000,
  staleMs = 60_000
): T {
  const parent = path.dirname(lockPath);
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });

  const startedAt = Date.now();
  const waitCell = new Int32Array(new SharedArrayBuffer(4));
  let acquired = false;

  while (!acquired) {
    try {
      fs.mkdirSync(lockPath, { mode: 0o700 });
      acquired = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;

      try {
        const ageMs = Date.now() - fs.statSync(lockPath).mtimeMs;
        if (ageMs > staleMs) {
          fs.rmSync(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw statError;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error("Brankas sedang digunakan proses lain. Silakan coba kembali.");
      }
      Atomics.wait(waitCell, 0, 0, 10);
    }
  }

  try {
    return operation();
  } finally {
    fs.rmSync(lockPath, { recursive: true, force: true });
  }
}
