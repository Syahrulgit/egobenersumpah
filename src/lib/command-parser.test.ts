import test from "node:test";
import assert from "node:assert/strict";
import { parseNaturalCommand } from "./command-parser";
import type { Account } from "../types/ego";

const mockAccounts: Account[] = [
  {
    id: "acc-gopay",
    owner_id: "owner-1",
    account_name: "GoPay",
    account_type: "ewallet",
    opening_balance: 500_000,
    currency: "IDR",
    is_active: true,
    created_at: "2026-11-01T00:00:00Z",
  },
  {
    id: "acc-bca",
    owner_id: "owner-1",
    account_name: "BCA",
    account_type: "bank",
    opening_balance: 10_000_000,
    currency: "IDR",
    is_active: true,
    created_at: "2026-11-01T00:00:00Z",
  },
  {
    id: "acc-mandiri",
    owner_id: "owner-1",
    account_name: "Tabungan Mandiri",
    account_type: "bank",
    opening_balance: 5_000_000,
    currency: "IDR",
    is_active: true,
    created_at: "2026-11-01T00:00:00Z",
  },
];

test("parses Indonesian expense slang with rb and GoPay", () => {
  const draft = parseNaturalCommand("tadi bayar kopi 25rb pakai gopay", mockAccounts);
  assert.equal(draft.transaction_type, "expense");
  assert.equal(draft.amount, 25_000);
  assert.equal(draft.source_account_id, "acc-gopay");
  assert.equal(draft.category, "Makanan & Minuman");
  assert.equal(draft.confidence, "high");
});

test("parses Indonesian income command with jt and BCA", () => {
  const draft = parseNaturalCommand("terima transfer gaji 15jt ke bca", mockAccounts);
  assert.equal(draft.transaction_type, "income");
  assert.equal(draft.amount, 15_000_000);
  assert.equal(draft.destination_account_id, "acc-bca");
  assert.equal(draft.category, "Gaji & Pendapatan");
  assert.equal(draft.confidence, "high");
});

test("parses decimal million expression for gold purchase", () => {
  const draft = parseNaturalCommand("beli emas 1 gram 1.4jt dari tabungan mandiri", mockAccounts);
  assert.equal(draft.transaction_type, "expense");
  assert.equal(draft.amount, 1_400_000);
  assert.equal(draft.source_account_id, "acc-mandiri");
  assert.equal(draft.category, "Investasi & Aset");
});

test("parses transfer between two accounts", () => {
  const draft = parseNaturalCommand("transfer 500k dari bca ke gopay", mockAccounts);
  assert.equal(draft.transaction_type, "transfer");
  assert.equal(draft.amount, 500_000);
  assert.equal(draft.source_account_id, "acc-bca");
  assert.equal(draft.destination_account_id, "acc-gopay");
});

test("marks missing amount as low confidence with warning", () => {
  const draft = parseNaturalCommand("bayar parkir di mall", mockAccounts);
  assert.equal(draft.amount, null);
  assert.equal(draft.confidence, "low");
  assert.ok(draft.warnings.length > 0);
});
