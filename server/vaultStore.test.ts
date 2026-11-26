import test from "node:test";
import assert from "node:assert/strict";
import {
  hashSessionToken,
  parseSessionsContent,
  parseVaultContent,
  VaultReadError,
} from "./vaultStore";

test("parseVaultContent preserves legacy vault compatibility and fills missing collections", () => {
  const vault = parseVaultContent(JSON.stringify({
    owner: null,
    accounts: [],
    preferences: { date_format: "DD MMM YYYY" },
  }));

  assert.equal(vault.owner, null);
  assert.deepEqual(vault.accounts, []);
  assert.deepEqual(vault.transactions, []);
  assert.equal(vault.preferences.expense_alert_limit, 5_000_000);
});

test("parseVaultContent rejects corrupt JSON instead of returning an empty vault", () => {
  assert.throws(() => parseVaultContent("{broken"), VaultReadError);
});

test("parseVaultContent rejects invalid vault roots and collection types", () => {
  assert.throws(() => parseVaultContent("[]"), VaultReadError);
  assert.throws(
    () => parseVaultContent(JSON.stringify({ accounts: {} })),
    /Bagian accounts/
  );
  assert.throws(
    () => parseVaultContent(JSON.stringify({ preferences: [] })),
    /Pengaturan brankas/
  );
});

test("parseSessionsContent accepts legacy plaintext sessions for safe migration", () => {
  const legacy = [{
    token: "legacy-token",
    owner_id: "owner-1",
    created_at: "2026-11-26T00:00:00.000Z",
  }];
  assert.deepEqual(parseSessionsContent(JSON.stringify(legacy)), legacy);
});

test("parseSessionsContent rejects corrupt or malformed session files without clearing them", () => {
  assert.throws(() => parseSessionsContent("{broken"), /File sesi EGO rusak/);
  assert.throws(() => parseSessionsContent(JSON.stringify([{ token: "only-token" }])), /Struktur file sesi EGO/);
});

test("hashSessionToken stores a one-way digest rather than the original token", () => {
  const token = "a-private-session-token";
  const digest = hashSessionToken(token);
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.notEqual(digest, token);
  assert.equal(hashSessionToken(token), digest);
});
