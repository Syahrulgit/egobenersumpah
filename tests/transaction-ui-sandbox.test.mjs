import test from "node:test";
import assert from "node:assert/strict";
import { createSandbox, submitSandboxTransaction, cancelSandboxTransaction } from "./fixtures/transaction-sandbox.js";

test("sandbox starts with fictional accounts and no ledger rows", () => {
  const state = createSandbox();
  assert.deepEqual(state.accounts.map((account) => account.balance), [1_000_000, 500_000]);
  assert.equal(state.transactions.length, 0);
});

test("refuses to record unless Owner explicitly confirms", () => {
  const state = createSandbox();
  assert.throws(() => submitSandboxTransaction(state, {
    type: "expense", amount: 25_000, sourceId: "cash", ownerConfirmed: false,
  }), /Konfirmasi Owner wajib/);
  assert.equal(state.accounts[0].balance, 1_000_000);
  assert.equal(state.transactions.length, 0);
});

test("records an expense and updates only the in-memory sandbox balance", () => {
  const state = createSandbox();
  submitSandboxTransaction(state, {
    id: "sandbox-expense-1", type: "expense", amount: 25_000,
    sourceId: "cash", ownerConfirmed: true,
  });
  assert.equal(state.accounts.find((account) => account.id === "cash").balance, 975_000);
  assert.equal(state.accounts.find((account) => account.id === "bank").balance, 500_000);
  assert.equal(state.transactions.length, 1);
});

test("records income and transfers with correct account effects", () => {
  const state = createSandbox();
  submitSandboxTransaction(state, {
    type: "income", amount: 100_000, destinationId: "bank", ownerConfirmed: true,
  });
  submitSandboxTransaction(state, {
    type: "transfer", amount: 50_000, sourceId: "cash",
    destinationId: "bank", ownerConfirmed: true,
  });
  assert.equal(state.accounts.find((account) => account.id === "cash").balance, 950_000);
  assert.equal(state.accounts.find((account) => account.id === "bank").balance, 650_000);
});

test("rejects zero, negative, non-integer, insufficient, and same-account transfers", () => {
  const state = createSandbox();
  for (const amount of [0, -1, 1.5]) {
    assert.throws(() => submitSandboxTransaction(state, {
      type: "expense", amount, sourceId: "cash", ownerConfirmed: true,
    }));
  }
  assert.throws(() => submitSandboxTransaction(state, {
    type: "expense", amount: 2_000_000, sourceId: "cash", ownerConfirmed: true,
  }), /Saldo uji tidak mencukupi/);
  assert.throws(() => submitSandboxTransaction(state, {
    type: "transfer", amount: 10, sourceId: "cash", destinationId: "cash", ownerConfirmed: true,
  }), /tidak boleh sama/);
  assert.equal(state.transactions.length, 0);
});

test("prevents duplicate request IDs and cancellation restores balances exactly once", () => {
  const state = createSandbox();
  submitSandboxTransaction(state, {
    id: "sandbox-replay", type: "expense", amount: 75_000,
    sourceId: "cash", ownerConfirmed: true,
  });
  assert.throws(() => submitSandboxTransaction(state, {
    id: "sandbox-replay", type: "expense", amount: 75_000,
    sourceId: "cash", ownerConfirmed: true,
  }), /sudah digunakan/);
  cancelSandboxTransaction(state, "sandbox-replay");
  assert.equal(state.accounts.find((account) => account.id === "cash").balance, 1_000_000);
  assert.equal(state.transactions[0].status, "cancelled");
  assert.throws(() => cancelSandboxTransaction(state, "sandbox-replay"), /tidak ditemukan/);
});
