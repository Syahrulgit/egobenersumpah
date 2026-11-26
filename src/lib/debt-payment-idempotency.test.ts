import test from "node:test";
import assert from "node:assert/strict";
import { isSameDebtPaymentRequest } from "./debt-payment-idempotency";

const request = {
  request_id: "9f7d4c10-5a0a-4c1b-8b1a-0e3a4d7c9f11",
  debt_id: "b8a5b86c-a76d-4e3f-9d4d-5b70b6d8c5a1",
  amount: 250000,
  source_account_id: "a1e4c9e1-1c4b-4e7f-a1a2-5b2d3c4e5f60",
  notes: "Cicilan November",
};
const log = {
  request_id: request.request_id,
  debt_id: request.debt_id,
  amount: "250000",
  notes: request.notes,
  transaction_id: "3e5a6d7c-8b9a-4c1d-8e2f-1a3b5c7d9e0f",
};
const transaction = {
  transaction_type: "expense",
  source_account_id: request.source_account_id,
  amount: 250000,
  category: "Utang & Cicilan",
  status: "posted",
  owner_confirmed: true,
};

test("accepts an exact retry of an already committed debt payment", () => {
  assert.equal(isSameDebtPaymentRequest(log, transaction, request), true);
});

test("rejects reuse of a payment request ID with different payment details", () => {
  assert.equal(isSameDebtPaymentRequest(log, transaction, { ...request, amount: 300000 }), false);
  assert.equal(isSameDebtPaymentRequest(log, transaction, { ...request, request_id: "different-request-id" }), false);
  assert.equal(isSameDebtPaymentRequest(log, transaction, { ...request, debt_id: "different-debt" }), false);
  assert.equal(isSameDebtPaymentRequest(log, transaction, { ...request, source_account_id: "different-account" }), false);
  assert.equal(isSameDebtPaymentRequest(log, transaction, { ...request, notes: "Catatan berbeda" }), false);
});

test("rejects incomplete, cancelled, or unconfirmed payment records", () => {
  assert.equal(isSameDebtPaymentRequest(null, transaction, request), false);
  assert.equal(isSameDebtPaymentRequest(log, null, request), false);
  assert.equal(isSameDebtPaymentRequest(log, { ...transaction, status: "cancelled" }, request), false);
  assert.equal(isSameDebtPaymentRequest(log, { ...transaction, owner_confirmed: false }, request), false);
});
