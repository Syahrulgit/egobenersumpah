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
      await createTx.mutateAsync({
        transaction_type: txType,
        source_account_id: txType === "income" ? null : sourceId,
        destination_account_id: txType === "expense" ? null : destId,
        amount,
        transaction_date: txDate,
        category,
        description: description.trim() || category,
        owner_confirmed: true,
      });

      if (txType === "expense" && expenseLimit > 0 && amount >= expenseLimit) {
        toast.warning(
          `Transaksi tersimpan. Nominal melebihi batas pengingat (${formatIDR(
            expenseLimit
          )}).`
        );
      } else {
        toast.success("Transaksi terverifikasi dan riwayat telah diperbarui.");
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
      setFormError(msg);
      toast.error(msg);
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
          <div className="rounded-2xl border border-dashed border-[#DCE4F0] bg-[#F4F7FB] p-6 text-center dark:border-[#1B3163] dark:bg-[#06132F]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#087BFF]/10 text-[#087BFF] dark:text-[#19D8FF]">
              <Wallet className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-[#06132F] dark:text-white">
              Belum Ada Akun Aktif
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-[#C7D0E0]/80">
              Daftarkan minimal satu rekening bank, e-wallet, atau dompet tunai sebelum mencatat transaksi.
            </p>
            <Link
              to="/akun"
              onClick={() => setIsOpen(false)}
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#087BFF] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#0666DB]"
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
              className="grid grid-cols-3 gap-1.5 rounded-2xl border border-[#DCE4F0] bg-[#EEF3FA] p-1 dark:border-[#1B3163] dark:bg-[#06132F]"
            >
              {(
                [
                  {
                    id: "expense",
                    label: "Pengeluaran",
                    icon: ArrowUpRight,
                    activeCls:
                      "bg-rose-600 text-white shadow-xs dark:bg-rose-500",
                  },
                  {
                    id: "income",
                    label: "Pemasukan",
                    icon: ArrowDownLeft,
                    activeCls:
                      "bg-[#087BFF] text-white shadow-xs",
                  },
                  {
                    id: "transfer",
                    label: "Transfer",
                    icon: ArrowLeftRight,
                    activeCls:
                      "bg-[#06132F] text-[#19D8FF] shadow-xs dark:bg-[#19D8FF] dark:text-[#06132F]",
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
                    className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? tab.activeCls
                        : "text-slate-600 hover:text-[#06132F] dark:text-[#C7D0E0]/75 dark:hover:text-white"
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
                    className="min-h-[34px] rounded-lg border border-[#DCE4F0] bg-[#F4F7FB] px-2.5 py-1 font-mono text-[11px] font-medium text-[#06132F] transition-colors hover:border-[#087BFF]/40 hover:bg-[#087BFF]/8 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0] dark:hover:border-[#19D8FF]/50"
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
                    className="block text-xs font-medium text-slate-700 dark:text-[#C7D0E0]"
                  >
                    Akun Sumber{" "}
                    <span className="text-rose-600 dark:text-rose-400">*</span>
                  </label>
                  <select
                    id="sheet-tx-source"
                    required
                    value={sourceId}
                    onChange={(e) => {
                      setSourceId(e.target.value);
                      setFormError(null);
                    }}
                    className="min-h-[44px] w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
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
                    className="block text-xs font-medium text-slate-700 dark:text-[#C7D0E0]"
                  >
                    Akun Tujuan{" "}
                    <span className="text-rose-600 dark:text-rose-400">*</span>
                  </label>
                  <select
                    id="sheet-tx-dest"
                    required
                    value={destId}
                    onChange={(e) => {
                      setDestId(e.target.value);
                      setFormError(null);
                    }}
                    className="min-h-[44px] w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
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
                  className="block text-xs font-medium text-slate-700 dark:text-[#C7D0E0]"
                >
                  Kategori
                </label>
                <select
                  id="sheet-tx-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
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
                  className="block text-xs font-medium text-slate-700 dark:text-[#C7D0E0]"
                >
                  Tanggal Transaksi
                </label>
                <input
                  id="sheet-tx-date"
                  type="date"
                  required
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 font-mono text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label
                htmlFor="sheet-tx-desc"
                className="block text-xs font-medium text-slate-700 dark:text-[#C7D0E0]"
              >
                Keterangan
              </label>
              <input
                id="sheet-tx-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Contoh: Kopi pagi, Gaji bulanan, atau Top up e-wallet"
                className="min-h-[44px] w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] placeholder:text-slate-400 focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#19D8FF]"
              />
            </div>

            {/* Pre-save Confirmation Summary */}
            <div className="rounded-2xl border border-[#DCE4F0] bg-[#F4F7FB] p-4 dark:border-[#1B3163] dark:bg-[#06132F]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#C7D0E0]/70">
                Ringkasan Sebelum Penyimpanan
              </p>
              <div className="mt-2.5 grid grid-cols-2 gap-y-1.5 text-xs">
                <span className="text-slate-500 dark:text-[#C7D0E0]/70">
                  Jenis &amp; Kategori
                </span>
                <span className="text-right font-semibold text-[#06132F] dark:text-white">
                  {typeLabel} · {category}
                </span>

                <span className="text-slate-500 dark:text-[#C7D0E0]/70">
                  Alur Akun
                </span>
                <span className="truncate text-right font-medium text-[#06132F] dark:text-[#C7D0E0]">
                  {summaryFlow}
                </span>

                <span className="text-slate-500 dark:text-[#C7D0E0]/70">
                  Tanggal
                </span>
                <span className="text-right font-mono text-[#06132F] dark:text-[#C7D0E0]">
                  {formatDateID(txDate, dateFormat)}
                </span>

                <span className="text-slate-500 dark:text-[#C7D0E0]/70">
                  Nominal
                </span>
                <span
                  className={`text-right font-mono text-sm font-bold tabular-nums ${
                    txType === "income"
                      ? "text-[#087BFF] dark:text-[#19D8FF]"
                      : txType === "expense"
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-[#06132F] dark:text-white"
                  }`}
                >
                  {formatIDR(amount)}
                </span>
              </div>
            </div>

            {formError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300"
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
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-[#087BFF]/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-500 disabled:shadow-none dark:disabled:bg-[#122652] dark:disabled:from-[#122652] dark:disabled:to-[#122652] dark:disabled:text-slate-500"
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
