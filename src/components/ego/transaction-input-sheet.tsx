import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  Plus,
  Wallet,
} from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { formatDateID, formatIDR, todayISO } from "../../lib/finance";
import { useCreateTransaction, useVaultSnapshot } from "../../lib/queries";
import type { TransactionType } from "../../types/ego";
import { EgoAnimatedMark } from "./ego-brand";
import { ApprovalCheck } from "./approval-check";
import { ModalSheet } from "./modal-sheet";
import { MoneyInput } from "./money-input";

export const CATEGORIES_BY_TYPE: Record<TransactionType, string[]> = {
  expense: [
    "Makanan & Minuman",
    "Transportasi",
    "Utilitas & Tagihan",
    "Belanja",
    "Investasi & Aset",
    "Utang & Cicilan",
    "Pengeluaran Lainnya",
  ],
  income: [
    "Gaji & Pendapatan",
    "Bonus & Investasi",
    "Penjualan & Refund",
    "Pemasukan Lainnya",
  ],
  transfer: ["Transfer Internal", "Tarik Tunai", "Top Up E-Wallet"],
};

const QUICK_AMOUNTS = [25_000, 50_000, 100_000, 500_000] as const;
const PENDING_TRANSACTION_REQUEST_KEY = "ego_pending_transaction_request_id";

function readPendingTransactionRequestId(): string | null {
  try {
    const id = window.sessionStorage.getItem(PENDING_TRANSACTION_REQUEST_KEY);
    return id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
      ? id
      : null;
  } catch {
    return null;
  }
}

function writePendingTransactionRequestId(id: string | null): void {
  try {
    if (id) {
      window.sessionStorage.setItem(PENDING_TRANSACTION_REQUEST_KEY, id);
    } else {
      window.sessionStorage.removeItem(PENDING_TRANSACTION_REQUEST_KEY);
    }
  } catch {
    // In-memory retry protection remains available if session storage is blocked.
  }
}

export interface OpenTransactionSheetOptions {
  type?: TransactionType;
  sourceAccountId?: string;
  destinationAccountId?: string;
  category?: string;
  description?: string;
  redirectOnSuccess?: boolean;
}

interface TransactionSheetContextValue {
  isOpen: boolean;
  openTransactionSheet: (opts?: OpenTransactionSheetOptions) => void;
  closeTransactionSheet: () => void;
}

const TransactionSheetContext = createContext<TransactionSheetContextValue | null>(
  null
);

export function useTransactionSheet(): TransactionSheetContextValue {
  const ctx = useContext(TransactionSheetContext);
  if (!ctx) {
    throw new Error(
      "useTransactionSheet harus digunakan di dalam TransactionSheetProvider."
    );
  }
  return ctx;
}

export function TransactionSheetProvider({
  children,
}: {
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: vault } = useVaultSnapshot(true);
  const createTx = useCreateTransaction();

  const [isOpen, setIsOpen] = useState(false);
  const [txType, setTxType] = useState<TransactionType>("expense");
  const [sourceId, setSourceId] = useState("");
  const [destId, setDestId] = useState("");
  const [amount, setAmount] = useState(0);
  const [txDate, setTxDate] = useState(todayISO());
  const [category, setCategory] = useState(CATEGORIES_BY_TYPE.expense[0]);
  const [description, setDescription] = useState("");
  const [ownerConfirmed, setOwnerConfirmed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [redirectAfterSave, setRedirectAfterSave] = useState(true);
  const submittingRef = useRef(false);
  const pendingRequestRef = useRef<{ id: string } | null>(null);

  const accounts = vault?.accounts ?? [];
  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.is_active),
    [accounts]
  );
  const dateFormat = vault?.preferences.date_format ?? "DD MMM YYYY";
  const expenseLimit = vault?.preferences.expense_alert_limit ?? 5_000_000;

  const accountMap = useMemo(() => {
    const map = new Map<string, (typeof activeAccounts)[number]>();
    for (const acc of activeAccounts) map.set(acc.id, acc);
    return map;
  }, [activeAccounts]);

  const openTransactionSheet = useCallback(
    (opts: OpenTransactionSheetOptions = {}) => {
      const nextType = opts.type ?? "expense";
      const firstId = activeAccounts[0]?.id ?? "";
      const secondId = activeAccounts[1]?.id ?? "";

      setTxType(nextType);
      setSourceId(
        opts.sourceAccountId ?? (nextType === "income" ? "" : firstId)
      );
      setDestId(
        opts.destinationAccountId ??
          (nextType === "income"
            ? firstId
            : nextType === "transfer"
              ? secondId
              : "")
      );
      setCategory(opts.category ?? CATEGORIES_BY_TYPE[nextType][0]);
      setDescription(opts.description ?? "");
      setAmount(0);
      setTxDate(todayISO());
      setOwnerConfirmed(false);
      setFormError(null);
      setRedirectAfterSave(opts.redirectOnSuccess ?? true);
      setIsOpen(true);
    },
    [activeAccounts]
  );

  const closeTransactionSheet = useCallback(() => {
    if (createTx.isPending || submittingRef.current) return;
    setIsOpen(false);
  }, [createTx.isPending]);

  function handleTabChange(nextType: TransactionType) {
    setTxType(nextType);
    setCategory(CATEGORIES_BY_TYPE[nextType][0]);
    setOwnerConfirmed(false);
    setFormError(null);

    if (nextType === "expense" && !sourceId && activeAccounts[0]) {
      setSourceId(activeAccounts[0].id);
    }
    if (nextType === "income" && !destId && activeAccounts[0]) {
      setDestId(activeAccounts[0].id);
    }
    if (nextType === "transfer") {
      const src = sourceId || activeAccounts[0]?.id || "";
      setSourceId(src);
      if (!destId || destId === src) {
        const alt = activeAccounts.find((a) => a.id !== src)?.id ?? "";
        setDestId(alt);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current || createTx.isPending) return;
    setFormError(null);

    if (!ownerConfirmed) {
      setFormError("Centang konfirmasi eksplisit Owner terlebih dahulu.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Nominal transaksi wajib lebih besar dari Rp 0.");
      return;
    }

    if (txType === "expense" && !sourceId) {
      setFormError("Pilih akun sumber dana terlebih dahulu.");
      return;
    }
    if (txType === "income" && !destId) {
      setFormError("Pilih akun tujuan pemasukan terlebih dahulu.");
      return;
    }
    if (txType === "transfer") {
      if (!sourceId || !destId) {
        setFormError("Pilih akun sumber dan akun tujuan transfer.");
        return;
      }
      if (sourceId === destId) {
        setFormError("Akun sumber dan tujuan transfer tidak boleh sama.");
        return;
      }
    }

    submittingRef.current = true;
    try {
      const transactionInput = {
        transaction_type: txType,
        source_account_id: txType === "income" ? null : sourceId,
        destination_account_id: txType === "expense" ? null : destId,
        amount,
        transaction_date: txDate,
        category,
        description: description.trim() || category,
        owner_confirmed: true,
      };
      const requestId =
        pendingRequestRef.current?.id ??
        readPendingTransactionRequestId() ??
        crypto.randomUUID();
      pendingRequestRef.current = { id: requestId };
      writePendingTransactionRequestId(requestId);

      await createTx.mutateAsync({
        ...transactionInput,
        id: requestId,
      });
      pendingRequestRef.current = null;
      writePendingTransactionRequestId(null);

      if (txType === "expense" && expenseLimit > 0 && amount >= expenseLimit) {
        toast.warning(
          `Transaksi tersimpan. Nominal melebihi batas pengingat (${formatIDR(
            expenseLimit
          )}).`,
          { icon: <EgoAnimatedMark size="sm" mode="warning" /> }
        );
      } else {
        toast.success("Transaksi terverifikasi dan riwayat telah diperbarui.", { icon: <EgoAnimatedMark size="sm" mode="success" /> });
      }

      setAmount(0);
      setDescription("");
      setOwnerConfirmed(false);
      setIsOpen(false);

      if (redirectAfterSave && pathname !== "/transaksi") {
        await navigate({ to: "/transaksi" });
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gagal menyimpan transaksi.";
      if (msg.includes("ID transaksi sudah digunakan untuk data berbeda")) {
        pendingRequestRef.current = null;
        writePendingTransactionRequestId(null);
        setOwnerConfirmed(false);
        const notice =
          "Percobaan sebelumnya sudah tercatat. Perubahan terbaru belum disimpan; konfirmasi ulang untuk mencatatnya sebagai transaksi baru.";
        setFormError(notice);
        toast.warning(notice);
      } else {
        setFormError(msg);
        toast.error(msg);
      }
    } finally {
      submittingRef.current = false;
    }
  }

  const srcName = sourceId ? accountMap.get(sourceId)?.account_name ?? "—" : "—";
  const dstName = destId ? accountMap.get(destId)?.account_name ?? "—" : "—";
  const summaryFlow =
    txType === "transfer"
      ? `${srcName} → ${dstName}`
      : txType === "income"
        ? `Masuk ke ${dstName}`
        : `Keluar dari ${srcName}`;

  const typeLabel =
    txType === "income"
      ? "Pemasukan"
      : txType === "transfer"
        ? "Transfer"
        : "Pengeluaran";

  return (
    <TransactionSheetContext.Provider
      value={{ isOpen, openTransactionSheet, closeTransactionSheet }}
    >
      {children}

      <ModalSheet
        open={isOpen}
        onClose={closeTransactionSheet}
        title="Catat Transaksi Baru"
        subtitle="Pilih jenis mutasi, isi rincian, lalu konfirmasi sebagai Owner."
        maxWidthClass="max-w-xl"
      >
        {activeAccounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-[#1E293B] dark:bg-[#0B111E]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#101827] text-[#E6C768] dark:bg-[#D4AF37]/15">
              <Wallet className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-[#101827] dark:text-white">
              Belum Ada Akun Aktif
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Daftarkan minimal satu rekening bank, e-wallet, atau dompet tunai sebelum mencatat transaksi.
            </p>
            <Link
              to="/akun"
              onClick={() => setIsOpen(false)}
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#E6C768] to-[#D4AF37] px-5 py-2.5 text-xs font-bold text-[#101827] transition-all hover:brightness-105"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Buka Halaman Akun</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 3 Transaction Types */}
            <div
              role="tablist"
              aria-label="Jenis Transaksi"
              className="grid grid-cols-3 gap-1.5 rounded-2xl border border-slate-200 bg-slate-100 p-1 dark:border-[#1E293B] dark:bg-[#0B111E]"
            >
              {(
                [
                  {
                    id: "expense",
                    label: "Pengeluaran",
                    icon: ArrowUpRight,
                    activeCls:
                      "bg-[#EF4444] text-white shadow-xs",
                  },
                  {
                    id: "income",
                    label: "Pemasukan",
                    icon: ArrowDownLeft,
                    activeCls:
                      "bg-[#14B8A6] text-white shadow-xs",
                  },
                  {
                    id: "transfer",
                    label: "Transfer",
                    icon: ArrowLeftRight,
                    activeCls:
                      "bg-[#101827] text-[#E6C768] shadow-xs ring-1 ring-[#D4AF37]/40 dark:bg-[#D4AF37] dark:text-[#101827]",
                  },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = txType === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => handleTabChange(tab.id)}
                    className={`ego-pressable flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? tab.activeCls
                        : "text-slate-600 hover:text-[#101827] dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Amount + Quick Presets */}
            <div className="space-y-2">
              <MoneyInput
                id="sheet-tx-amount"
                label="Nominal (IDR)"
                value={amount}
                onChange={(val) => {
                  setAmount(val);
                  setFormError(null);
                }}
                large
                required
              />
              <div className="flex flex-wrap gap-1.5">
                {QUICK_AMOUNTS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setAmount(preset);
                      setFormError(null);
                    }}
                    className="ego-pressable min-h-[36px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-medium text-[#101827] transition-colors hover:border-[#D4AF37]/60 hover:bg-[#D4AF37]/10 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-300 dark:hover:border-[#D4AF37]/50"
                  >
                    +{formatIDR(preset, true)}
                  </button>
                ))}
              </div>
            </div>

            {/* Contextual Account Selectors */}
            <div
              className={`grid gap-3 ${
                txType === "transfer" ? "sm:grid-cols-2" : "grid-cols-1"
              }`}
            >
              {txType !== "income" ? (
                <div className="space-y-1.5">
                  <label
                    htmlFor="sheet-tx-source"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Akun Sumber{" "}
                    <span className="text-[#EF4444]">*</span>
                  </label>
                  <select
                    id="sheet-tx-source"
                    required
                    value={sourceId}
                    onChange={(e) => {
                      setSourceId(e.target.value);
                      setFormError(null);
                    }}
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:focus:border-[#D4AF37]"
                  >
                    <option value="">Pilih akun sumber...</option>
                    {activeAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_name} ({formatIDR(acc.current_balance)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {txType !== "expense" ? (
                <div className="space-y-1.5">
                  <label
                    htmlFor="sheet-tx-dest"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Akun Tujuan{" "}
                    <span className="text-[#EF4444]">*</span>
                  </label>
                  <select
                    id="sheet-tx-dest"
                    required
                    value={destId}
                    onChange={(e) => {
                      setDestId(e.target.value);
                      setFormError(null);
                    }}
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:focus:border-[#D4AF37]"
                  >
                    <option value="">Pilih akun tujuan...</option>
                    {activeAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_name} ({formatIDR(acc.current_balance)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            {/* Category + Date */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="sheet-tx-category"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Kategori
                </label>
                <select
                  id="sheet-tx-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:focus:border-[#D4AF37]"
                >
                  {CATEGORIES_BY_TYPE[txType].map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="sheet-tx-date"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Tanggal Transaksi
                </label>
                <input
                  id="sheet-tx-date"
                  type="date"
                  required
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm text-[#101827] focus:border-[#D4AF37] focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:focus:border-[#D4AF37]"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label
                htmlFor="sheet-tx-desc"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Keterangan
              </label>
              <input
                id="sheet-tx-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Contoh: Kopi pagi, Gaji bulanan, atau Top up e-wallet"
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-[#101827] placeholder:text-slate-400 focus:border-[#D4AF37] focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#D4AF37]"
              />
            </div>

            {/* Pre-save Confirmation Summary */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#1E293B] dark:bg-[#0B111E]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Ringkasan Sebelum Penyimpanan
              </p>
              <div className="mt-2.5 grid grid-cols-2 gap-y-1.5 text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  Jenis &amp; Kategori
                </span>
                <span className="text-right font-semibold text-[#101827] dark:text-white">
                  {typeLabel} · {category}
                </span>

                <span className="text-slate-500 dark:text-slate-400">
                  Alur Akun
                </span>
                <span className="truncate text-right font-medium text-[#101827] dark:text-slate-200">
                  {summaryFlow}
                </span>

                <span className="text-slate-500 dark:text-slate-400">
                  Tanggal
                </span>
                <span className="text-right font-mono text-[#101827] dark:text-slate-200">
                  {formatDateID(txDate, dateFormat)}
                </span>

                <span className="text-slate-500 dark:text-slate-400">
                  Nominal
                </span>
                <span
                  className={`text-right font-mono text-sm font-bold tabular-nums ${
                    txType === "income"
                      ? "text-[#0D9488] dark:text-[#2DD4BF]"
                      : txType === "expense"
                        ? "text-[#DC2626] dark:text-[#F87171]"
                        : "text-[#101827] dark:text-[#E6C768]"
                  }`}
                >
                  {formatIDR(amount)}
                </span>
              </div>
            </div>

            {formError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-[#EF4444]/35 bg-[#EF4444]/10 px-3.5 py-2.5 text-xs font-medium text-[#DC2626] dark:text-[#F87171]"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{formError}</span>
              </div>
            ) : null}

            <ApprovalCheck
              id="sheet-tx-owner-confirm"
              checked={ownerConfirmed}
              onChange={setOwnerConfirmed}
              disabled={createTx.isPending}
            />

            <button
              type="submit"
              disabled={!ownerConfirmed || createTx.isPending}
              className="ego-pressable flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E6C768] to-[#D4AF37] px-4 py-3 text-sm font-bold text-[#101827] shadow-md shadow-[#D4AF37]/20 transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-500 disabled:shadow-none dark:disabled:bg-[#162032] dark:disabled:from-[#162032] dark:disabled:to-[#162032] dark:disabled:text-slate-500"
            >
              {createTx.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Menyimpan ke Brankas...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>Konfirmasi &amp; Simpan Transaksi</span>
                </>
              )}
            </button>
          </form>
        )}
      </ModalSheet>
    </TransactionSheetContext.Provider>
  );
}
