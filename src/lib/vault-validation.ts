import type {
  AccountType,
  AssetType,
  DebtPaymentFrequency,
  DebtType,
  GoalType,
  RecurringFrequency,
  ReminderCategory,
  ReminderFrequency,
  TransactionStatus,
  TransactionType,
  WhatIfScenarioType,
} from "../types/ego";

export const OWNER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_ACCOUNT_TYPES = new Set<AccountType>(["cash", "bank", "ewallet"]);
const VALID_ASSET_TYPES = new Set<AssetType>([
  "emas",
  "properti",
  "kendaraan",
  "investasi",
  "elektronik",
  "lainnya",
]);
const VALID_DEBT_TYPES = new Set<DebtType>([
  "kpr",
  "kendaraan",
  "kartu_kredit",
  "pinjaman_pribadi",
  "paylater",
  "usaha",
  "lainnya",
]);
const VALID_DEBT_FREQUENCIES = new Set<DebtPaymentFrequency>([
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
]);
const VALID_WHATIF_TYPES = new Set<WhatIfScenarioType>([
  "cash_purchase",
  "installment_purchase",
  "new_loan",
  "accelerated_debt_payoff",
  "income_change",
  "living_cost_change",
  "savings_boost",
  "goal_milestone",
]);
const VALID_FREQUENCIES = new Set<RecurringFrequency>([
  "weekly",
  "monthly",
  "yearly",
]);
const VALID_REMINDER_CATEGORIES = new Set<ReminderCategory>([
  "tagihan_bulanan",
  "cicilan_utang",
  "jatuh_tempo",
  "tanggal_gajian",
  "setoran_tabungan",
  "target_keuangan",
  "pemasukan_rutin",
]);
const VALID_REMINDER_FREQUENCIES = new Set<ReminderFrequency>([
  "once",
  "weekly",
  "monthly",
  "yearly",
]);

export function validateAccountInput(input: {
  account_name: string;
  account_type: string;
  opening_balance: number;
  owner_confirmed: boolean;
}): void {
  if (!input.owner_confirmed) {
    throw new Error("Persetujuan eksplisit Owner wajib dicentang sebelum membuat akun.");
  }
  const name = input.account_name.trim();
  if (name.length < 1 || name.length > 80) {
    throw new Error("Nama akun wajib 1–80 karakter.");
  }
  if (!VALID_ACCOUNT_TYPES.has(input.account_type as AccountType)) {
    throw new Error("Jenis akun tidak valid.");
  }
  if (!Number.isFinite(input.opening_balance) || input.opening_balance < 0) {
    throw new Error("Saldo awal harus berupa angka >= 0.");
  }
}

export function validateTransactionPayload(input: {
  transaction_type: TransactionType;
  source_account_id: string | null;
  destination_account_id: string | null;
  amount: number;
  status: TransactionStatus;
  owner_confirmed: boolean;
}): void {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Nominal transaksi harus lebih besar dari Rp 0.");
  }

  if (input.status === "posted" && input.owner_confirmed !== true) {
    throw new Error(
      "Prinsip Brankas Mutlak: Transaksi berstatus posted wajib memiliki persetujuan eksplisit Owner."
    );
  }

  if (input.transaction_type === "income") {
    if (!input.destination_account_id) {
      throw new Error("Pemasukan wajib memilih akun tujuan yang valid milik Owner.");
    }
  } else if (input.transaction_type === "expense") {
    if (!input.source_account_id) {
      throw new Error("Pengeluaran wajib memilih akun sumber yang valid milik Owner.");
    }
  } else if (input.transaction_type === "transfer") {
    if (!input.source_account_id || !input.destination_account_id) {
      throw new Error("Transfer wajib memilih akun sumber dan akun tujuan yang valid.");
    }
    if (input.source_account_id === input.destination_account_id) {
      throw new Error("Akun sumber dan akun tujuan transfer tidak boleh sama.");
    }
  } else {
    throw new Error("Jenis transaksi tidak dikenali.");
  }
}

export function validateAssetInput(input: {
  asset_name: string;
  asset_type: string;
  current_value: number;
  quantity?: number | null;
  owner_confirmed: boolean;
}): void {
  if (!input.owner_confirmed) {
    throw new Error("Persetujuan eksplisit Owner wajib dicentang sebelum mencatat aset.");
  }
  const name = input.asset_name.trim();
  if (name.length < 1 || name.length > 120) {
    throw new Error("Nama aset wajib diisi (maks 120 karakter).");
  }
  if (!VALID_ASSET_TYPES.has(input.asset_type as AssetType)) {
    throw new Error("Kategori aset tidak valid.");
  }
  if (!Number.isFinite(input.current_value) || input.current_value < 0) {
    throw new Error("Nilai aset harus >= 0.");
  }
  if (
    input.quantity !== null &&
    input.quantity !== undefined &&
    (!Number.isFinite(input.quantity) || input.quantity < 0)
  ) {
    throw new Error("Kuantitas aset harus berupa angka >= 0.");
  }
}

export function validateDebtInput(input: {
  creditor: string;
  debt_type?: string;
  original_amount: number;
  outstanding_balance: number;
  interest_rate_annual?: number;
  monthly_fee?: number;
  installment_amount?: number;
  payment_frequency?: string;
  owner_confirmed: boolean;
}): void {
  if (!input.owner_confirmed) {
    throw new Error("Persetujuan eksplisit Owner wajib dicentang sebelum mencatat utang.");
  }
  const creditor = input.creditor.trim();
  if (creditor.length < 1 || creditor.length > 120) {
    throw new Error("Nama kreditur wajib diisi (maks 120 karakter).");
  }
  if (
    input.debt_type !== undefined &&
    !VALID_DEBT_TYPES.has(input.debt_type as DebtType)
  ) {
    throw new Error("Jenis utang tidak valid.");
  }
  if (!Number.isFinite(input.original_amount) || input.original_amount <= 0) {
    throw new Error("Plafon awal utang harus lebih besar dari Rp 0.");
  }
  if (!Number.isFinite(input.outstanding_balance) || input.outstanding_balance < 0) {
    throw new Error("Sisa pokok utang tidak valid.");
  }
  if (
    input.interest_rate_annual !== undefined &&
    (!Number.isFinite(input.interest_rate_annual) ||
      input.interest_rate_annual < 0 ||
      input.interest_rate_annual > 300)
  ) {
    throw new Error("Bunga tahunan harus antara 0% hingga 300%.");
  }
  if (
    input.monthly_fee !== undefined &&
    (!Number.isFinite(input.monthly_fee) || input.monthly_fee < 0)
  ) {
    throw new Error("Biaya administrasi bulanan harus >= Rp 0.");
  }
  if (
    input.installment_amount !== undefined &&
    (!Number.isFinite(input.installment_amount) || input.installment_amount < 0)
  ) {
    throw new Error("Nominal cicilan rutin harus >= Rp 0.");
  }
  if (
    input.payment_frequency !== undefined &&
    !VALID_DEBT_FREQUENCIES.has(input.payment_frequency as DebtPaymentFrequency)
  ) {
    throw new Error("Frekuensi cicilan utang tidak valid.");
  }
}

export function validateDebtPaymentInput(
  debt: { status: string; outstanding_balance: number },
  paymentAmount: number,
  sourceAccountId: string,
  ownerConfirmed: boolean
): void {
  if (!ownerConfirmed) {
    throw new Error(
      "Persetujuan eksplisit Owner wajib dicentang sebelum membayar utang."
    );
  }
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    throw new Error("Nominal pembayaran utang harus lebih besar dari Rp 0.");
  }
  if (debt.status === "paid" || Number(debt.outstanding_balance) <= 0) {
    throw new Error("Utang ini sudah berstatus lunas.");
  }
  if (paymentAmount > Number(debt.outstanding_balance)) {
    throw new Error("Nominal pembayaran melebihi sisa pokok utang saat ini.");
  }
  if (!sourceAccountId) {
    throw new Error("Pilih akun sumber pembayaran utang.");
  }
}

export function validateRecurringBillInput(input: {
  title: string;
  transaction_type: string;
  amount: number;
  frequency: string;
  next_due_date: string;
  owner_confirmed: boolean;
}): void {
  if (!input.owner_confirmed) {
    throw new Error(
      "Persetujuan eksplisit Owner wajib dicentang sebelum menyimpan jadwal rutin."
    );
  }
  if (!input.title || input.title.trim().length > 120) {
    throw new Error(
      "Nama tagihan atau pemasukan rutin wajib diisi (maks 120 karakter)."
    );
  }
  if (input.transaction_type !== "income" && input.transaction_type !== "expense") {
    throw new Error("Jenis transaksi rutin harus Pemasukan atau Pengeluaran.");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Nominal tagihan rutin harus lebih besar dari Rp 0.");
  }
  if (!VALID_FREQUENCIES.has(input.frequency as RecurringFrequency)) {
    throw new Error("Frekuensi jadwal rutin tidak valid.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.next_due_date)) {
    throw new Error("Tanggal jatuh tempo wajib diisi dalam format YYYY-MM-DD.");
  }
}

export function validateSavingsGoalInput(input: {
  title: string;
  goal_type: string;
  target_amount: number;
  current_amount: number;
  owner_confirmed: boolean;
}): void {
  if (!input.owner_confirmed) {
    throw new Error(
      "Persetujuan eksplisit Owner wajib dicentang sebelum membuat target tabungan."
    );
  }
  if (!input.title || input.title.trim().length > 120) {
    throw new Error("Nama target tabungan wajib diisi (maks 120 karakter).");
  }
  if (
    input.goal_type !== ("emergency_fund" satisfies GoalType) &&
    input.goal_type !== ("savings_target" satisfies GoalType)
  ) {
    throw new Error("Jenis target tidak valid.");
  }
  if (!Number.isFinite(input.target_amount) || input.target_amount <= 0) {
    throw new Error("Target dana harus lebih besar dari Rp 0.");
  }
  if (!Number.isFinite(input.current_amount) || input.current_amount < 0) {
    throw new Error("Dana terkumpul awal harus >= Rp 0.");
  }
}

export function validateFinancialReminderInput(input: {
  title: string;
  reminder_type: string;
  transaction_type: string;
  amount: number;
  due_date: string;
  reminder_time: string;
  frequency: string;
  remind_offsets: number[];
  custom_days_before?: number | null;
  owner_confirmed: boolean;
}): void {
  if (!input.owner_confirmed) {
    throw new Error(
      "Persetujuan eksplisit Owner wajib dicentang sebelum menyimpan pengingat keuangan."
    );
  }
  const title = (input.title ?? "").trim();
  if (title.length < 1 || title.length > 140) {
    throw new Error("Judul pengingat wajib diisi (1–140 karakter).");
  }
  if (!VALID_REMINDER_CATEGORIES.has(input.reminder_type as ReminderCategory)) {
    throw new Error("Jenis pengingat keuangan tidak valid.");
  }
  if (
    input.transaction_type !== "income" &&
    input.transaction_type !== "expense" &&
    input.transaction_type !== "transfer"
  ) {
    throw new Error("Tipe arus kas pengingat tidak valid.");
  }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new Error("Nominal pengingat harus berupa angka >= Rp 0.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test((input.due_date ?? "").slice(0, 10))) {
    throw new Error("Tanggal jatuh tempo wajib dalam format YYYY-MM-DD.");
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.reminder_time ?? "")) {
    throw new Error("Waktu pengingat wajib dalam format JJ:MM (contoh 08:00).");
  }
  if (!VALID_REMINDER_FREQUENCIES.has(input.frequency as ReminderFrequency)) {
    throw new Error("Frekuensi pengingat tidak valid.");
  }
  if (!Array.isArray(input.remind_offsets)) {
    throw new Error("Daftar jadwal pengingat (H-7/H-3/H-1/H-0) tidak valid.");
  }
  for (const offset of input.remind_offsets) {
    if (!Number.isInteger(offset) || offset < 0 || offset > 90) {
      throw new Error("Offset pengingat harus bilangan bulat antara 0 hingga 90 hari.");
    }
  }
  if (
    input.custom_days_before !== null &&
    input.custom_days_before !== undefined &&
    (!Number.isInteger(input.custom_days_before) ||
      input.custom_days_before < 0 ||
      input.custom_days_before > 90)
  ) {
    throw new Error("Pengingat khusus (H-n) harus antara 0 hingga 90 hari.");
  }
  const hasCustom =
    input.custom_days_before !== null && input.custom_days_before !== undefined;
  if (input.remind_offsets.length === 0 && !hasCustom) {
    throw new Error(
      "Pilih minimal satu waktu pengingat (H-7, H-3, H-1, H-0, atau hari khusus)."
    );
  }
}

export function validateCategoryBudgetInput(input: {
  category: string;
  period_month: string;
  limit_amount: number;
  owner_confirmed: boolean;
}): void {
  if (!input.owner_confirmed) {
    throw new Error(
      "Persetujuan eksplisit Owner wajib dicentang sebelum menyimpan anggaran kategori."
    );
  }
  const category = (input.category ?? "").trim();
  if (category.length < 1 || category.length > 80) {
    throw new Error("Kategori anggaran wajib diisi (1–80 karakter).");
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test((input.period_month ?? "").trim())) {
    throw new Error("Periode anggaran wajib dalam format YYYY-MM (contoh 2026-11).");
  }
  if (!Number.isFinite(input.limit_amount) || input.limit_amount <= 0) {
    throw new Error("Batas anggaran harus lebih besar dari Rp 0.");
  }
}

export function validateWhatIfScenarioInput(input: {
  title: string;
  scenario_type: string;
  amount: number;
  tenor_months: number;
  annual_interest_pct: number;
}): void {
  const title = (input.title ?? "").trim();
  if (title.length < 1 || title.length > 140) {
    throw new Error("Nama skenario What-If wajib diisi (1–140 karakter).");
  }
  if (!VALID_WHATIF_TYPES.has(input.scenario_type as WhatIfScenarioType)) {
    throw new Error("Jenis skenario simulasi What-If tidak valid.");
  }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new Error("Nominal simulasi tidak valid.");
  }
  if (!Number.isInteger(input.tenor_months) || input.tenor_months < 1 || input.tenor_months > 360) {
    throw new Error("Tenor simulasi harus antara 1 hingga 360 bulan.");
  }
  if (!Number.isFinite(input.annual_interest_pct) || input.annual_interest_pct < 0 || input.annual_interest_pct > 200) {
    throw new Error("Bunga tahunan simulasi harus antara 0% hingga 200%.");
  }
}
