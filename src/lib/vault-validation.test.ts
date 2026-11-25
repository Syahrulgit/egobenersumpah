import assert from "node:assert/strict";
import test from "node:test";
import {
  OWNER_EMAIL_REGEX,
  validateAccountInput,
  validateAssetInput,
  validateCategoryBudgetInput,
  validateDebtInput,
  validateDebtPaymentInput,
  validateFinancialReminderInput,
  validateRecurringBillInput,
  validateSavingsGoalInput,
  validateTransactionPayload,
  validateWhatIfScenarioInput,
} from "./vault-validation.ts";

test("OWNER_EMAIL_REGEX accepts valid emails and rejects malformed ones", () => {
  assert.equal(OWNER_EMAIL_REGEX.test("uulsyahrul123@gmail.com"), true);
  assert.equal(OWNER_EMAIL_REGEX.test("invalid-email"), false);
  assert.equal(OWNER_EMAIL_REGEX.test("a@b"), false);
  assert.equal(OWNER_EMAIL_REGEX.test("user @domain.com"), false);
});

test("validateAccountInput enforces confirmation, name bounds, type, and opening balance", () => {
  assert.throws(() =>
    validateAccountInput({
      account_name: "BCA",
      account_type: "bank",
      opening_balance: 1000,
      owner_confirmed: false,
    })
  );
  assert.throws(() =>
    validateAccountInput({
      account_name: " ",
      account_type: "bank",
      opening_balance: 1000,
      owner_confirmed: true,
    })
  );
  assert.throws(() =>
    validateAccountInput({
      account_name: "Crypto",
      account_type: "crypto",
      opening_balance: 1000,
      owner_confirmed: true,
    })
  );
  assert.throws(() =>
    validateAccountInput({
      account_name: "BCA",
      account_type: "bank",
      opening_balance: -5,
      owner_confirmed: true,
    })
  );
  assert.doesNotThrow(() =>
    validateAccountInput({
      account_name: "Dompet Tunai",
      account_type: "cash",
      opening_balance: 0,
      owner_confirmed: true,
    })
  );
});

test("validateTransactionPayload enforces Prinsip Brankas Mutlak and transfer account rules", () => {
  assert.throws(() =>
    validateTransactionPayload({
      transaction_type: "expense",
      source_account_id: "acc-1",
      destination_account_id: null,
      amount: 0,
      status: "posted",
      owner_confirmed: true,
    })
  );
  assert.throws(() =>
    validateTransactionPayload({
      transaction_type: "expense",
      source_account_id: "acc-1",
      destination_account_id: null,
      amount: 50000,
      status: "posted",
      owner_confirmed: false,
    })
  );
  assert.throws(() =>
    validateTransactionPayload({
      transaction_type: "income",
      source_account_id: null,
      destination_account_id: null,
      amount: 50000,
      status: "posted",
      owner_confirmed: true,
    })
  );
  assert.throws(() =>
    validateTransactionPayload({
      transaction_type: "transfer",
      source_account_id: "acc-1",
      destination_account_id: "acc-1",
      amount: 50000,
      status: "posted",
      owner_confirmed: true,
    })
  );
  assert.doesNotThrow(() =>
    validateTransactionPayload({
      transaction_type: "transfer",
      source_account_id: "acc-1",
      destination_account_id: "acc-2",
      amount: 50000,
      status: "posted",
      owner_confirmed: true,
    })
  );
});

test("validateAssetInput, validateDebtInput, validateDebtPaymentInput enforce positive invariants", () => {
  assert.throws(() =>
    validateAssetInput({
      asset_name: "Emas Antam",
      asset_type: "invalid",
      current_value: 1000000,
      owner_confirmed: true,
    })
  );
  assert.throws(() =>
    validateAssetInput({
      asset_name: "Emas Antam",
      asset_type: "emas",
      current_value: 1000000,
      quantity: -1,
      owner_confirmed: true,
    })
  );
  assert.doesNotThrow(() =>
    validateAssetInput({
      asset_name: "Emas Antam",
      asset_type: "emas",
      current_value: 1500000,
      quantity: 1,
      owner_confirmed: true,
    })
  );

  assert.throws(() =>
    validateDebtInput({
      creditor: "Bank X",
      original_amount: 0,
      outstanding_balance: 0,
      owner_confirmed: true,
    })
  );
  assert.throws(() =>
    validateDebtPaymentInput(
      { status: "paid", outstanding_balance: 0 },
      10000,
      "acc-1",
      true
    )
  );
  assert.throws(() =>
    validateDebtPaymentInput(
      { status: "active", outstanding_balance: 100000 },
      150000,
      "acc-1",
      true
    )
  );
  assert.doesNotThrow(() =>
    validateDebtPaymentInput(
      { status: "active", outstanding_balance: 100000 },
      50000,
      "acc-1",
      true
    )
  );
});

test("validateRecurringBillInput and validateSavingsGoalInput validate schedule and goal fields", () => {
  assert.throws(() =>
    validateRecurringBillInput({
      title: "Internet",
      transaction_type: "transfer",
      amount: 350000,
      frequency: "monthly",
      next_due_date: "2026-12-01",
      owner_confirmed: true,
    })
  );
  assert.throws(() =>
    validateRecurringBillInput({
      title: "Internet",
      transaction_type: "expense",
      amount: 350000,
      frequency: "monthly",
      next_due_date: "01-12-2026",
      owner_confirmed: true,
    })
  );
  assert.doesNotThrow(() =>
    validateRecurringBillInput({
      title: "Internet",
      transaction_type: "expense",
      amount: 350000,
      frequency: "monthly",
      next_due_date: "2026-12-01",
      owner_confirmed: true,
    })
  );

  assert.throws(() =>
    validateSavingsGoalInput({
      title: "Dana Darurat",
      goal_type: "other",
      target_amount: 10000000,
      current_amount: 0,
      owner_confirmed: true,
    })
  );
  assert.doesNotThrow(() =>
    validateSavingsGoalInput({
      title: "Dana Darurat",
      goal_type: "emergency_fund",
      target_amount: 10000000,
      current_amount: 500000,
      owner_confirmed: true,
    })
  );
});

test("validateFinancialReminderInput enforces Owner confirmation, offsets, time format, and categories", () => {
  assert.throws(() =>
    validateFinancialReminderInput({
      title: "Listrik PLN",
      reminder_type: "tagihan_bulanan",
      transaction_type: "expense",
      amount: 400000,
      due_date: "2026-12-10",
      reminder_time: "08:00",
      frequency: "monthly",
      remind_offsets: [7, 3, 1, 0],
      custom_days_before: null,
      owner_confirmed: false,
    })
  );
  assert.throws(() =>
    validateFinancialReminderInput({
      title: "Listrik PLN",
      reminder_type: "tagihan_bulanan",
      transaction_type: "expense",
      amount: 400000,
      due_date: "2026-12-10",
      reminder_time: "25:99",
      frequency: "monthly",
      remind_offsets: [7],
      custom_days_before: null,
      owner_confirmed: true,
    })
  );
  assert.throws(() =>
    validateFinancialReminderInput({
      title: "Listrik PLN",
      reminder_type: "tagihan_bulanan",
      transaction_type: "expense",
      amount: 400000,
      due_date: "2026-12-10",
      reminder_time: "08:00",
      frequency: "monthly",
      remind_offsets: [],
      custom_days_before: null,
      owner_confirmed: true,
    })
  );
  assert.doesNotThrow(() =>
    validateFinancialReminderInput({
      title: "Setoran Target Rumah",
      reminder_type: "setoran_tabungan",
      transaction_type: "transfer",
      amount: 2500000,
      due_date: "2026-12-01",
      reminder_time: "09:30",
      frequency: "monthly",
      remind_offsets: [],
      custom_days_before: 5,
      owner_confirmed: true,
    })
  );
});

test("validateCategoryBudgetInput enforces Owner confirmation, period format, category, and positive limit", () => {
  assert.throws(() =>
    validateCategoryBudgetInput({
      category: "Makanan & Minuman",
      period_month: "2026-11",
      limit_amount: 1_500_000,
      owner_confirmed: false,
    })
  );
  assert.throws(() =>
    validateCategoryBudgetInput({
      category: "   ",
      period_month: "2026-11",
      limit_amount: 1_500_000,
      owner_confirmed: true,
    })
  );
  assert.throws(() =>
    validateCategoryBudgetInput({
      category: "Transportasi",
      period_month: "2026-13",
      limit_amount: 1_500_000,
      owner_confirmed: true,
    })
  );
  assert.throws(() =>
    validateCategoryBudgetInput({
      category: "Transportasi",
      period_month: "2026-11",
      limit_amount: 0,
      owner_confirmed: true,
    })
  );
  assert.doesNotThrow(() =>
    validateCategoryBudgetInput({
      category: "Makanan & Minuman",
      period_month: "2026-11",
      limit_amount: 2_000_000,
      owner_confirmed: true,
    })
  );
});

test("validateDebtInput and validateWhatIfScenarioInput enforce extended metadata bounds", () => {
  assert.throws(() =>
    validateDebtInput({
      creditor: "Bank XYZ",
      debt_type: "crypto_loan",
      original_amount: 10_000_000,
      outstanding_balance: 8_000_000,
      owner_confirmed: true,
    })
  );
  assert.throws(() =>
    validateDebtInput({
      creditor: "Bank XYZ",
      debt_type: "kartu_kredit",
      original_amount: 10_000_000,
      outstanding_balance: 8_000_000,
      interest_rate_annual: 350,
      owner_confirmed: true,
    })
  );
  assert.doesNotThrow(() =>
    validateDebtInput({
      creditor: "KPR BCA",
      debt_type: "kpr",
      original_amount: 300_000_000,
      outstanding_balance: 250_000_000,
      interest_rate_annual: 7.5,
      monthly_fee: 25_000,
      installment_amount: 3_200_000,
      payment_frequency: "monthly",
      owner_confirmed: true,
    })
  );

  assert.throws(() =>
    validateWhatIfScenarioInput({
      title: "",
      scenario_type: "cash_purchase",
      amount: 5_000_000,
      tenor_months: 1,
      annual_interest_pct: 0,
    })
  );
  assert.throws(() =>
    validateWhatIfScenarioInput({
      title: "Cicilan Laptop",
      scenario_type: "invalid_mode",
      amount: 12_000_000,
      tenor_months: 12,
      annual_interest_pct: 10,
    })
  );
  assert.throws(() =>
    validateWhatIfScenarioInput({
      title: "Cicilan Laptop",
      scenario_type: "installment_purchase",
      amount: 12_000_000,
      tenor_months: 0,
      annual_interest_pct: 10,
    })
  );
  assert.doesNotThrow(() =>
    validateWhatIfScenarioInput({
      title: "Beli Laptop Kerja",
      scenario_type: "installment_purchase",
      amount: 12_000_000,
      tenor_months: 12,
      annual_interest_pct: 12,
    })
  );
});

