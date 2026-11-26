import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { withFileLock } from "./fileLock";

test("file lock exists only during the protected operation", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ego-file-lock-"));
  const lockPath = path.join(dir, "critical.lock");
  try {
    const result = withFileLock(lockPath, () => {
      assert.equal(fs.existsSync(lockPath), true);
      return "completed";
    });
    assert.equal(result, "completed");
    assert.equal(fs.existsSync(lockPath), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("file lock is released even when the protected operation throws", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ego-file-lock-"));
  const lockPath = path.join(dir, "critical.lock");
  try {
    assert.throws(() => withFileLock(lockPath, () => { throw new Error("expected"); }), /expected/);
    assert.equal(fs.existsSync(lockPath), false);
    assert.equal(withFileLock(lockPath, () => 42), 42);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
