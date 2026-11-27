import assert from "node:assert/strict";
import test from "node:test";
import {
  BACKUP_COLLECTIONS,
  EGO_BACKUP_APP,
  EGO_BACKUP_VERSION,
  createEgoRestorePayload,
  parseEgoBackupPreview,
} from "./backup-restore";

function makeBackup(overrides: Record<string, unknown> = {}) {
  const data: Record<string, unknown[]> = Object.fromEntries(BACKUP_COLLECTIONS.map((key) => [key, []]));
  data.accounts = [{ id: "account-1", account_name: "Tunai" }];
  return JSON.stringify({
    app: EGO_BACKUP_APP,
    version: EGO_BACKUP_VERSION,
    exported_at: "2026-11-27T05:00:00.000Z",
    owner_email: "owner@example.com",
    data,
    ...overrides,
  });
}

test("valid backup produces a read-only preview, collection counts, and Owner preferences", () => {
  const preview = parseEgoBackupPreview(makeBackup({
    data: {
      ...Object.fromEntries(BACKUP_COLLECTIONS.map((key) => [key, key === "accounts" ? [{ id: "account-1", account_name: "Tunai" }] : []])),
      preferences: { date_format: "DD MMM YYYY", expense_alert_limit: 5_000_000 },
    },
  }));
  assert.equal(preview.totalRecords, 1);
  assert.equal(preview.counts.accounts, 1);
  assert.equal(preview.counts.transactions, 0);
  assert.deepEqual(preview.preferences, { date_format: "DD MMM YYYY", expense_alert_limit: 5_000_000 });
});

test("rejects malformed JSON and wrong app identifier", () => {
  assert.throws(() => parseEgoBackupPreview("{"), /JSON yang valid/);
  assert.throws(() => parseEgoBackupPreview(JSON.stringify({ app: "other" })), /bukan cadangan resmi/);
});

test("rejects unsupported version and invalid export timestamp", () => {
  assert.throws(() => parseEgoBackupPreview(makeBackup({ version: "9.0" })), /Versi cadangan/);
  assert.throws(() => parseEgoBackupPreview(makeBackup({ exported_at: "invalid" })), /Waktu ekspor/);
});

test("rejects backups from another Owner account", () => {
  assert.throws(
    () => parseEgoBackupPreview(makeBackup(), undefined, "different@example.com"),
    /akun Owner yang berbeda/
  );
});

test("rejects missing collections, malformed rows, and duplicate IDs", () => {
  const missing: Record<string, unknown[]> = Object.fromEntries(BACKUP_COLLECTIONS.filter((key) => key !== "debts").map((key) => [key, []]));
  assert.throws(() => parseEgoBackupPreview(makeBackup({ data: missing })), /debts/);

  const malformed: Record<string, unknown[]> = Object.fromEntries(BACKUP_COLLECTIONS.map((key) => [key, []]));
  malformed.accounts = [null];
  assert.throws(() => parseEgoBackupPreview(makeBackup({ data: malformed })), /Baris 1/);

  const duplicate: Record<string, unknown[]> = Object.fromEntries(BACKUP_COLLECTIONS.map((key) => [key, []]));
  duplicate.accounts = [{ id: "same" }, { id: "same" }];
  assert.throws(() => parseEgoBackupPreview(makeBackup({ data: duplicate })), /ID ganda/);
});

test("counts conflicts against current data without modifying it", () => {
  const current = { accounts: [{ id: "account-1" }] };
  const before = JSON.stringify(current);
  const preview = parseEgoBackupPreview(makeBackup(), current);
  assert.equal(preview.existingIdConflicts.accounts, 1);
  assert.equal(JSON.stringify(current), before);
});


test("restore payload converts UI ewallet values to database enum values", () => {
  const data: Record<string, unknown[]> = Object.fromEntries(BACKUP_COLLECTIONS.map((key) => [key, []]));
  data.accounts = [{
    id: "account-1",
    account_name: "Dompet",
    account_type: "ewallet",
    opening_balance: 0,
    currency: "IDR",
    is_active: true,
    created_at: "2026-11-27T05:00:00.000Z",
    owner_id: "untrusted-owner",
    current_balance: 0,
  }];
  const preview = parseEgoBackupPreview(makeBackup({ data }));
  const payload = createEgoRestorePayload(preview);
  const restoredAccount = payload.data.accounts[0] as Record<string, unknown>;
  assert.equal(restoredAccount.account_type, "e_wallet");
  assert.equal(restoredAccount.owner_id, undefined);
  assert.equal(restoredAccount.current_balance, undefined);
  assert.equal(payload.owner_email, "owner@example.com");
});

test("restore payload refuses backups without an Owner identity", () => {
  const preview = parseEgoBackupPreview(makeBackup({ owner_email: null }));
  assert.throws(() => createEgoRestorePayload(preview), /identitas Owner/);
});


test("rejects malformed Owner preferences instead of applying them", () => {
  const data = Object.fromEntries(BACKUP_COLLECTIONS.map((key) => [key, []]));
  assert.throws(
    () => parseEgoBackupPreview(makeBackup({
      data: { ...data, preferences: { date_format: "invalid", expense_alert_limit: -1 } },
    })),
    /Preferensi Owner/
  );
});
