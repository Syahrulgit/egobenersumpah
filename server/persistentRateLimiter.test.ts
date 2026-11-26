import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPersistentLoginRateLimiter } from "./persistentRateLimiter";

function withTempDir(run: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ego-rate-limit-"));
  try {
    run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("persistent limiter keeps failed attempts after a new instance is created", () => {
  withTempDir((dir) => {
    const first = createPersistentLoginRateLimiter("login", 2, 60_000, dir);
    const second = createPersistentLoginRateLimiter("login", 2, 60_000, dir);
    assert.equal(first.recordFailure("ip-private-1", 1_000).remainingAttempts, 1);
    assert.equal(second.recordFailure("ip-private-1", 2_000).allowed, false);
    assert.equal(first.check("ip-private-1", 3_000).allowed, false);
  });
});

test("persistent limiter expires windows and reset clears only its namespace key", () => {
  withTempDir((dir) => {
    const login = createPersistentLoginRateLimiter("login", 2, 1_000, dir);
    const pin = createPersistentLoginRateLimiter("pin", 2, 1_000, dir);
    login.recordFailure("same-client", 1_000);
    login.recordFailure("same-client", 1_100);
    assert.equal(login.check("same-client", 1_200).allowed, false);
    assert.equal(pin.check("same-client", 1_200).allowed, true);
    assert.equal(login.check("same-client", 2_001).allowed, true);
    login.recordFailure("same-client", 3_000);
    login.reset("same-client");
    assert.equal(login.check("same-client", 3_001).allowed, true);
  });
});

test("persistent limiter stores a digest of the client key, not the raw key", () => {
  withTempDir((dir) => {
    const limiter = createPersistentLoginRateLimiter("login", 5, 60_000, dir);
    const privateKey = "sensitive-client-key";
    limiter.recordFailure(privateKey, 10_000);
    const stored = fs.readFileSync(path.join(dir, "ego-rate-limits.json"), "utf8");
    assert.equal(stored.includes(privateKey), false);
    assert.match(stored, /[0-9a-f]{64}/);
  });
});

test("corrupt limiter storage fails closed instead of resetting attempts", () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, "ego-rate-limits.json"), "{broken");
    const limiter = createPersistentLoginRateLimiter("login", 5, 60_000, dir);
    assert.throws(() => limiter.check("client", 10_000), /Login ditahan demi keamanan/);
    assert.throws(() => limiter.recordFailure("client", 10_000), /Login ditahan demi keamanan/);
  });
});
