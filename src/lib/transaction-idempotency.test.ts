import test from "node:test";
import assert from "node:assert/strict";
import {
  isSameConfirmedTransactionRequest,
  isValidTransactionRequestId,
  type ConfirmedTransactionRequest,
} from "./transaction-idempotency";

const request: ConfirmedTransactionRequest = {
  transaction_type: "expense",
  source_account_id: "account-cash",
  destination_account_id: null,
  amount: 125000,
  transaction_date: "2026-11-26",
  category: "Makanan",
  description: "Makan siang",
  status: "posted",
  owner_confirmed: true,
};

const existing = {
  id: "9f7d4c10-5a0a-4c1b-8b1a-0e3a4d7c9f11",
  ...request,
  amount: "125000",
};

test("accepts a retry only when it matches the same posted confirmed transaction", () => {
  assert.equal(isSameConfirmedTransactionRequest(existing, request), true);
});

test("rejects a retry when any transaction detail differs", () => {
  assert.equal(
    isSameConfirmedTransactionRequest(existing, { ...request, amount: 130000 }),
    false
  );
  assert.equal(
    isSameConfirmedTransactionRequest(existing, { ...request, description: "Makan malam" }),
    false
  );
  assert.equal(
    isSameConfirmedTransactionRequest(existing, { ...request, source_account_id: "account-bank" }),
    false
  );
  assert.equal(
    isSameConfirmedTransactionRequest(existing, { ...request, status: "pending" }),
    false
  );
  assert.equal(
    isSameConfirmedTransactionRequest(existing, { ...request, owner_confirmed: false }),
    false
  );
});

test("rejects a pre-existing row that is not posted and owner-confirmed", () => {
  assert.equal(
    isSameConfirmedTransactionRequest({ ...existing, owner_confirmed: false }, request),
    false
  );
  assert.equal(
    isSameConfirmedTransactionRequest({ ...existing, status: "cancelled" }, request),
    false
  );
});

test("validates UUID request identifiers and rejects malformed values", () => {
  assert.equal(isValidTransactionRequestId(existing.id), true);
  assert.equal(isValidTransactionRequestId("not-a-uuid"), false);
  assert.equal(isValidTransactionRequestId(null), false);
});
