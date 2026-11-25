import test from "node:test";
import assert from "node:assert/strict";
import {
  assertSingleOwnerAvailable,
  createEmptyVault,
  createLoginRateLimiter,
  validateChangePasswordInput,
  validateDebtPayment,
  validateOwnerEmailUpdateInput,
  validatePinFormat,
  validateRecurringBillInput,
  validateResetOwnerConfirmation,
  validateSavingsGoalInput,
  validateTransactionInvariants,
} from "./vaultRules";
import type { Account, Debt } from "../src/types/ego";

const ownerId = "owner-uuid-1";

const sampleAccounts: Account[] = [
  {
    id: "acc-1",
    owner_id: ownerId,
    account_name: "BCA",
    account_type: "bank",
    opening_balance: 5_000_000,
    currency: "IDR",
    is_active: true,
    created_at: "2026-11-01T00:00:00Z",
  },
  {
    id: "acc-2",
    owner_id: ownerId,
    account_name: "GoPay",
    account_type: "ewallet",
    opening_balance: 200_000,
    currency: "IDR",
    is_active: true,
    created_at: "2026-11-01T00:00:00Z",
  },
];

test("assertSingleOwnerAvailable rejects second owner registration", () => {
  const db = createEmptyVault();
  assert.doesNotThrow(() => assertSingleOwnerAvailable(db));

  db.owner = {
    id: ownerId,
    email: "owner@ego.local",
    full_name: "Owner Utama",
    password_hash: "hashed",
    created_at: "2026-11-01T00:00:00Z",
  };

  assert.throws(() => assertSingleOwnerAvailable(db), /Single-Owner/i);
});

test("validateTransactionInvariants blocks posted transaction without owner_confirmed", () => {
  assert.throws(
    () =>
      validateTransactionInvariants(
        {
          owner_id: ownerId,
          transaction_type: "expense",
          source_account_id: "acc-1",
          destination_account_id: null,
          amount: 50_000,
          status: "posted",
          owner_confirmed: false,
        },
        sampleAccounts
      ),
    /Prinsip Brankas Mutlak/i
  );
});

test("validateTransactionInvariants enforces transfer source != destination", () => {
  assert.throws(
    () =>
      validateTransactionInvariants(
        {
          owner_id: ownerId,
          transaction_type: "transfer",
          source_account_id: "acc-1",
          destination_account_id: "acc-1",
          amount: 100_000,
          status: "posted",
          owner_confirmed: true,
        },
        sampleAccounts
      ),
    /tidak boleh sama/i
  );
});

test("validateDebtPayment rejects overpayment and missing confirmation", () => {
  const debt: Debt = {
    id: "debt-1",
    owner_id: ownerId,
    creditor: "Kartu Kredit",
    original_amount: 2_000_000,
    outstanding_balance: 1_000_000,
    due_date: "2026-12-01",
    status: "active",
    description: null,
    created_at: "2026-11-01T00:00:00Z",
  };

  assert.throws(() => validateDebtPayment(debt, 500_000, "acc-1", false));
  assert.throws(() => validateDebtPayment(debt, 1_500_000, "acc-1", true));
  assert.doesNotThrow(() => validateDebtPayment(debt, 500_000, "acc-1", true));
});

test("createLoginRateLimiter blocks after 5 failures and resets after cooldown or success", () => {
  const limiter = createLoginRateLimiter(5, 15 * 60 * 1000);
  const start = 1_700_000_000_000;

  assert.equal(limiter.check("ip1", start).allowed, true);
  for (let i = 0; i < 4; i++) {
    const res = limiter.recordFailure("ip1", start + i * 1000);
    assert.equal(res.allowed, true);
    assert.equal(res.remainingAttempts, 4 - i);
  }

  const locked = limiter.recordFailure("ip1", start + 5000);
  assert.equal(locked.allowed, false);
  assert.equal(locked.remainingAttempts, 0);
  assert.ok(locked.retryAfterSeconds > 0);
  assert.match(locked.message ?? "", /tunggu/i);

  // Still locked before 15 minutes pass
  assert.equal(limiter.check("ip1", start + 60_000).allowed, false);

  // Unlocks cleanly after 15 minutes
  assert.equal(limiter.check("ip1", start + 15 * 60 * 1000 + 1).allowed, true);

  // Reset on success clears counter immediately
  limiter.recordFailure("ip2", start);
  limiter.reset("ip2");
  assert.equal(limiter.check("ip2", start + 1000).remainingAttempts, 5);
});

test("validateRecurringBillInput enforces owner confirmation and valid schedule fields", () => {
  assert.throws(
    () =>
      validateRecurringBillInput({
        title: "Internet Rumah",
        transaction_type: "expense",
        amount: 350_000,
        frequency: "monthly",
        next_due_date: "2026-12-01",
        owner_confirmed: false,
      }),
    /Persetujuan eksplisit Owner/i
  );

  assert.throws(
    () =>
      validateRecurringBillInput({
        title: "Tagihan",
        transaction_type: "expense",
        amount: 0,
        frequency: "monthly",
        next_due_date: "2026-12-01",
        owner_confirmed: true,
      }),
    /lebih besar dari Rp 0/i
  );

  assert.doesNotThrow(() =>
    validateRecurringBillInput({
      title: "Internet Rumah",
      transaction_type: "expense",
      amount: 350_000,
      frequency: "monthly",
      next_due_date: "2026-12-01",
      owner_confirmed: true,
    })
  );
});

test("validateSavingsGoalInput enforces owner confirmation and positive target amount", () => {
  assert.throws(
    () =>
      validateSavingsGoalInput({
        title: "Dana Darurat",
        goal_type: "emergency_fund",
        target_amount: 30_000_000,
        current_amount: 0,
        owner_confirmed: false,
      }),
    /Persetujuan eksplisit Owner/i
  );

  assert.throws(
    () =>
      validateSavingsGoalInput({
        title: "Dana Darurat",
        goal_type: "emergency_fund",
        target_amount: -100,
        current_amount: 0,
        owner_confirmed: true,
      }),
    /lebih besar dari Rp 0/i
  );

  assert.doesNotThrow(() =>
    validateSavingsGoalInput({
      title: "Dana Darurat",
      goal_type: "emergency_fund",
      target_amount: 30_000_000,
      current_amount: 5_000_000,
      owner_confirmed: true,
    })
  );
});

test("validateChangePasswordInput enforces minimum length, current password, and difference", () => {
  assert.throws(
    () =>
      validateChangePasswordInput({
        current_password: "",
        new_password: "baru123",
      }),
    /saat ini wajib diisi/i
  );
  assert.throws(
    () =>
      validateChangePasswordInput({
        current_password: "lama123",
        new_password: "123",
      }),
    /minimal 6 karakter/i
  );
  assert.throws(
    () =>
      validateChangePasswordInput({
        current_password: "sama123",
        new_password: "sama123",
      }),
    /harus berbeda/i
  );
  assert.doesNotThrow(() =>
    validateChangePasswordInput({
      current_password: "lama123",
      new_password: "baru123",
    })
  );
});

test("validatePinFormat requires exactly 6 numeric digits", () => {
  assert.throws(() => validatePinFormat("12345"), /6 digit angka/i);
  assert.throws(() => validatePinFormat("12345a"), /6 digit angka/i);
  assert.throws(() => validatePinFormat("1234567"), /6 digit angka/i);
  assert.doesNotThrow(() => validatePinFormat("048291"));
});

test("validateOwnerEmailUpdateInput validates email, full_name, and current_password", () => {
  assert.throws(
    () =>
      validateOwnerEmailUpdateInput({
        email: "bukan-email",
        full_name: "Syahrul",
        current_password: "secret",
      }),
    /Format email Owner tidak valid/i
  );
  assert.throws(
    () =>
      validateOwnerEmailUpdateInput({
        email: "owner@example.com",
        full_name: " ",
        current_password: "secret",
      }),
    /Nama panggilan Owner/i
  );
  assert.throws(
    () =>
      validateOwnerEmailUpdateInput({
        email: "owner@example.com",
        full_name: "Syahrul",
        current_password: "",
      }),
    /Kata sandi saat ini wajib diisi/i
  );

  const normalized = validateOwnerEmailUpdateInput({
    email: "  Syahrul.Baru@Example.COM ",
    full_name: " Syahrul Utama ",
    current_password: "secret",
  });
  assert.deepEqual(normalized, {
    email: "syahrul.baru@example.com",
    full_name: "Syahrul Utama",
  });
});

test("validateResetOwnerConfirmation requires checkbox acknowledgment and HAPUS keyword", () => {
  assert.throws(
    () =>
      validateResetOwnerConfirmation({
        confirmed: false,
        confirmation_text: "HAPUS",
      }),
    /Centang persetujuan/i
  );
  assert.throws(
    () =>
      validateResetOwnerConfirmation({
        confirmed: true,
        confirmation_text: "salah",
      }),
    /HAPUS/
  );
  assert.doesNotThrow(() =>
    validateResetOwnerConfirmation({
      confirmed: true,
      confirmation_text: "hapus",
    })
  );
});

