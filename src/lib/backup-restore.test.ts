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
  data.accounts = [{ id: "01010101-0101-4101-8101-010101010101", account_name: "Tunai" }];
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
      ...Object.fromEntries(BACKUP_COLLECTIONS.map((key) => [key, key === "accounts" ? [{ id: "01010101-0101-4101-8101-010101010101", account_name: "Tunai" }] : []])),
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

test("treats the backup email as editable metadata, not authentication", () => {
  const preview = parseEgoBackupPreview(makeBackup(), undefined, "different@example.com");
  assert.equal(preview.ownerMetadataMismatch, true);
  assert.equal(preview.ownerEmail, "owner@example.com");
});

test("rejects invalid UUIDs and non-finite or negative financial values", () => {
  const invalidId: Record<string, unknown[]> = Object.fromEntries(BACKUP_COLLECTIONS.map((key) => [key, []]));
  invalidId.accounts = [{ id: "not-a-uuid" }];
  assert.throws(() => parseEgoBackupPreview(makeBackup({ data: invalidId })), /UUID yang valid/);

  const invalidAmount: Record<string, unknown[]> = Object.fromEntries(BACKUP_COLLECTIONS.map((key) => [key, []]));
  invalidAmount.transactions = [{
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    amount: -1,
  }];
  assert.throws(() => parseEgoBackupPreview(makeBackup({ data: invalidAmount })), /Nilai amount/);
});

test("calculates a read-only financial impact summary from posted records", () => {
  const data: Record<string, unknown[]> = Object.fromEntries(BACKUP_COLLECTIONS.map((key) => [key, []]));
  data.transactions = [
    { id: "11111111-1111-4111-8111-111111111111", transaction_type: "income", status: "posted", amount: 500 },
    { id: "22222222-2222-4222-8222-222222222222", transaction_type: "expense", status: "posted", amount: 125 },
    { id: "33333333-3333-4333-8333-333333333333", transaction_type: "income", status: "pending", amount: 999 },
  ];
  data.debts = [{ id: "44444444-4444-4444-8444-444444444444", outstanding_balance: 250 }];
  data.assets = [{ id: "55555555-5555-4555-8555-555555555555", current_value: 700 }];
  const preview = parseEgoBackupPreview(makeBackup({ data }));
  assert.deepEqual(preview.financialSummary, {
    postedIncome: 500,
    postedExpenses: 125,
    netCashflow: 375,
    outstandingDebt: 250,
    assetValue: 700,
  });
});

test("rejects missing collections, malformed rows, and duplicate IDs", () => {
  const missing: Record<string, unknown[]> = Object.fromEntries(BACKUP_COLLECTIONS.filter((key) => key !== "debts").map((key) => [key, []]));
  assert.throws(() => parseEgoBackupPreview(makeBackup({ data: missing })), /debts/);

  const malformed: Record<string, unknown[]> = Object.fromEntries(BACKUP_COLLECTIONS.map((key) => [key, []]));
  malformed.accounts = [null];
  assert.throws(() => parseEgoBackupPreview(makeBackup({ data: malformed })), /Baris 1/);

  const duplicate: Record<string, unknown[]> = Object.fromEntries(BACKUP_COLLECTIONS.map((key) => [key, []]));
  duplicate.accounts = [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }, { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }];
  assert.throws(() => parseEgoBackupPreview(makeBackup({ data: duplicate })), /ID ganda/);
});

test("counts conflicts against current data without modifying it", () => {
  const current = { accounts: [{ id: "01010101-0101-4101-8101-010101010101" }] };
  const before = JSON.stringify(current);
  const preview = parseEgoBackupPreview(makeBackup(), current);
  assert.equal(preview.existingIdConflicts.accounts, 1);
  assert.equal(JSON.stringify(current), before);
});


test("restore payload converts UI ewallet values to database enum values", () => {
  const data: Record<string, unknown[]> = Object.fromEntries(BACKUP_COLLECTIONS.map((key) => [key, []]));
  data.accounts = [{
    id: "01010101-0101-4101-8101-010101010101",
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
