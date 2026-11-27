import { Link } from "@tanstack/react-router";
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  Loader2,
  Plus,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../../components/ego/app-shell";
import { EgoCompanion } from "../../components/ego/ego-brand";
import { ApprovalCheck } from "../../components/ego/approval-check";
import { AccountTypeIcon, CategoryIcon } from "../../components/ego/category-icon";
import {
  EgoAnimatedBar,
  EgoCountUp,
  EgoStaggerSection,
} from "../../components/ego/ego-motion";
import { ModalSheet } from "../../components/ego/modal-sheet";
import { MoneyInput } from "../../components/ego/money-input";
import { useTransactionSheet } from "../../components/ego/transaction-input-sheet";
import {
  accountTypeLabel,
  filterTransactions,
  formatDateID,
  formatIDR,
  groupAccountsByType,
} from "../../lib/finance";
import {
  useCreateAccount,
  useToggleAccountActive,
  useVaultSnapshot,
} from "../../lib/queries";
import type { AccountBalance, AccountType } from "../../types/ego";

export function AkunPage() {
  const { data: vault, isLoading } = useVaultSnapshot(true);
  const createAccount = useCreateAccount();
  const toggleActive = useToggleAccountActive();
  const { openTransactionSheet } = useTransactionSheet();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountBalance | null>(
    null
  );

  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("bank");
  const [openingBalance, setOpeningBalance] = useState(0);
  const [ownerConfirmed, setOwnerConfirmed] = useState(false);

  const accounts = vault?.accounts ?? [];
  const transactions = vault?.transactions ?? [];
  const dateFormat = vault?.preferences.date_format ?? "DD MMM YYYY";
  const grouped = groupAccountsByType(accounts);
  const totalLiquidity = accounts
    .filter((a) => a.is_active)
    .reduce((sum, a) => sum + a.current_balance, 0);

  const liquidityByType = useMemo(() => {
    const active = accounts.filter((a) => a.is_active);
    const sums: Record<AccountType, number> = { bank: 0, ewallet: 0, cash: 0 };
    for (const acc of active) {
      sums[acc.account_type] += Math.max(0, acc.current_balance);
    }
    const denom = Math.max(1, sums.bank + sums.ewallet + sums.cash);
    return (["bank", "ewallet", "cash"] as const).map((t) => ({
      type: t,
      label: accountTypeLabel(t),
      amount: sums[t],
      pct: totalLiquidity > 0 ? Math.round((sums[t] / denom) * 100) : 0,
      count: grouped[t].filter((a) => a.is_active).length,
    }));
  }, [accounts, grouped, totalLiquidity]);

  const selectedAccountTx = useMemo(() => {
    if (!selectedAccount) return [];
    return filterTransactions(transactions, {
      accountId: selectedAccount.id,
    }).slice(0, 12);
  }, [selectedAccount, transactions]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerConfirmed) return;
    if (!accountName.trim()) {
      toast.error("Nama akun wajib diisi.");
      return;
    }

    try {
      await createAccount.mutateAsync({
        account_name: accountName.trim(),
        account_type: accountType,
        opening_balance: openingBalance,
        owner_confirmed: true,
      });
      toast.success(`Akun "${accountName.trim()}" berhasil ditambahkan.`);
      setAccountName("");
      setOpeningBalance(0);
      setOwnerConfirmed(false);
      setCreateModalOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menambahkan akun."
      );
    }
  }

  async function handleToggleArchive(id: string, nextActive: boolean) {
    try {
      await toggleActive.mutateAsync({ id, is_active: nextActive });
      toast.success(
        nextActive ? "Akun diaktifkan kembali." : "Akun berhasil diarsipkan."
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memperbarui status akun."
      );
    }
  }

  return (
    <AppShell
      title="Akun Keuangan"
      subtitle="Rekening bank, e-wallet, dan dompet tunai dengan pantauan saldo aktual."
      action={
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-3.5 py-2 text-xs font-semibold text-[#101827] shadow-sm shadow-[#D4AF37]/20 hover:brightness-105 whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Tambah Akun</span>
        </button>
      }
    >
      <div className="space-y-6">
        <EgoStaggerSection index={0} className="space-y-4">
        {/* Liquidity Hero Banner */}
        <section className="ego-card-hero ego-card-hero--living ego-main-card relative isolate overflow-hidden flex flex-col justify-between gap-4 rounded-3xl border border-[#D4AF37]/30 p-5 text-white shadow-lg shadow-[#101827]/20 sm:flex-row sm:items-center sm:p-6">
          <span
            className="ego-main-card__robo ego-main-card__robo--hero"
            aria-hidden="true"
          >
            <EgoCompanion size="lg" mode="idle" />
          </span>
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#E6C768]/90">
              Total Likuiditas Aktif
            </p>
            <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-white sm:text-3xl">
              <EgoCountUp value={totalLiquidity} formatter={(v) => formatIDR(v)} />
            </p>
            <p className="mt-1 text-xs text-slate-300">
              {accounts.filter((a) => a.is_active).length} akun aktif ·{" "}
              {accounts.filter((a) => !a.is_active).length} diarsipkan
            </p>
          </div>
          <div className="relative z-10 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openTransactionSheet({ type: "transfer" })}
              className="ego-pressable inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/12 px-4 py-2 text-xs font-semibold text-[#E6C768] transition-colors hover:bg-[#D4AF37]/20"
            >
              <span>Transfer Antar-Akun</span>
            </button>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="ego-pressable inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2 text-xs font-semibold text-[#101827] hover:brightness-105"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Akun Baru</span>
            </button>
          </div>
        </section>

        {/* Unified account balance composition */}
        {accounts.some((account) => account.is_active) ? (
          <section className="rounded-[1.5rem] border border-[#D4AF37]/20 bg-gradient-to-br from-[#101827] via-[#101827] to-[#15233A] p-4 shadow-lg shadow-[#06132F]/15 ring-1 ring-white/5 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold tracking-wide text-white">Komposisi Saldo</h2>
                <p className="mt-0.5 text-[11px] text-[#C7D0E0]/65">Persentase dari total likuiditas aktif</p>
              </div>
              <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-[#E8C96A]">{formatIDR(totalLiquidity)}</span>
            </div>
            <div className="flex h-3.5 w-full overflow-hidden rounded-full border border-[#D4AF37]/15 bg-[#06132F] shadow-inner" role="img" aria-label={liquidityByType.map((item) => `${item.label} ${item.pct} persen`).join(", ")}>
              {liquidityByType.map((item) => (
                <span key={item.type} className="h-full shrink-0 transition-[width] duration-700 ease-out first:rounded-l-full last:rounded-r-full" style={{ width: `${item.pct}%`, backgroundColor: item.type === "bank" ? "#D4AF37" : item.type === "cash" ? "#14B8A6" : "#FF4DDE" }} />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {liquidityByType.map((item) => (
                <div key={item.type} className="min-w-0">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.type === "bank" ? "#D4AF37" : item.type === "cash" ? "#14B8A6" : "#FF4DDE" }} aria-hidden="true" />
                    <span className="truncate text-[11px] text-[#C7D0E0]/70">{item.label}</span>
                  </div>
                  <p className="font-mono text-sm font-bold tabular-nums text-white">{item.pct}%</p>
                  <p className="mt-0.5 truncate font-mono text-[10px] tabular-nums text-[#C7D0E0]/60">{formatIDR(item.amount)}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        </EgoStaggerSection>

    

        {/* Banking Card Grids */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((k) => (
              <div
                key={k}
                className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-[#1E293B] dark:bg-[#101827]"
              />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-[#1E293B] dark:bg-[#101827]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D4AF37]/15 text-[#9A7411] dark:bg-[#D4AF37]/15 dark:text-[#E6C768]">
              <Wallet className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="mt-3.5 text-base font-bold text-[#101827] dark:text-white">
              Belum Ada Akun Keuangan
            </h2>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Daftarkan rekening bank, e-wallet, atau kas tunai pertama Anda untuk mulai melacak saldo secara real-time.
            </p>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="mt-4 inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2 text-xs font-semibold text-[#101827] hover:brightness-105"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tambah Akun Pertama</span>
            </button>
          </div>
        ) : (
          <EgoStaggerSection index={1} className="space-y-6">
            {(["bank", "ewallet", "cash"] as const).map((groupType) => {
              const items = grouped[groupType];
              if (items.length === 0) return null;
              return (
                <section key={groupType} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <AccountTypeIcon
                      type={groupType}
                      className="h-4 w-4 text-[#9A7411] dark:text-[#E6C768]"
                    />
                    <h2 className="text-sm font-bold text-[#101827] dark:text-white">
                      {accountTypeLabel(groupType)} ({items.length})
                    </h2>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((acc) => {
                      const isBankHero =
                        acc.is_active && acc.account_type === "bank";
                      return (
                        <div
                          key={acc.id}
                          className={`ego-main-card ego-main-card--account group relative isolate overflow-hidden rounded-[1.5rem] border p-5 transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1 hover:shadow-xl active:scale-[0.99] ${
                            !acc.is_active
                              ? "border-slate-200 bg-slate-100/80 opacity-75 dark:border-[#1E293B] dark:bg-[#0B111E]/80"
                              : isBankHero
                                ? "ego-card-hero border-[#D4AF37]/30 text-white shadow-md shadow-[#101827]/15"
                                : "border-slate-200 bg-white shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none"
                          }`}
                        >
                          <span className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37]/80 to-transparent opacity-80" aria-hidden="true" />
                          <span className="ego-main-card__robo" aria-hidden="true">
                            <EgoCompanion size="md" mode="idle" />
                          </span>
                          <div className="relative z-10 flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-3">
                              <span
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 shadow-sm ${
                                  isBankHero
                                    ? "bg-[#D4AF37]/18 text-[#E6C768]"
                                    : "bg-[#D4AF37]/12 text-[#9A7411] dark:bg-[#D4AF37]/15 dark:text-[#E6C768]"
                                }`}
                              >
                                <AccountTypeIcon
                                  type={acc.account_type}
                                  className="h-4 w-4"
                                />
                              </span>
                              <div className="min-w-0">
                                <h3
                                  className={`truncate text-sm font-bold ${
                                    isBankHero
                                      ? "text-white"
                                      : "text-[#101827] dark:text-white"
                                  }`}
                                >
                                  {acc.account_name}
                                </h3>
                                <p
                                  className={`mt-0.5 text-xs ${
                                    isBankHero
                                      ? "text-slate-300"
                                      : "text-slate-500 dark:text-slate-400"
                                  }`}
                                >
                                  {accountTypeLabel(acc.account_type)} ·{" "}
                                  {acc.is_active ? "Aktif" : "Diarsipkan"}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleToggleArchive(acc.id, !acc.is_active)
                              }
                              aria-label={
                                acc.is_active
                                  ? `Arsipkan ${acc.account_name}`
                                  : `Aktifkan ${acc.account_name}`
                              }
                              className={`inline-flex min-h-[34px] items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                                isBankHero
                                  ? "border-white/15 bg-white/10 text-slate-200 hover:bg-white/20 hover:text-white"
                                  : "border-slate-200 bg-slate-50 text-slate-600 hover:text-[#101827] dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-300"
                              }`}
                            >
                              {acc.is_active ? (
                                <>
                                  <Archive className="h-3 w-3" aria-hidden="true" />
                                  <span>Arsipkan</span>
                                </>
                              ) : (
                                <>
                                  <ArchiveRestore
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                  />
                                  <span>Aktifkan</span>
                                </>
                              )}
                            </button>
                          </div>

                          <div
                            className={`relative z-10 mt-4 border-t pt-3.5 ${
                              isBankHero
                                ? "border-white/12"
                                : "border-slate-200 dark:border-[#1E293B]"
                            }`}
                          >
                            <p
                              className={`text-[11px] ${
                                isBankHero
                                  ? "text-slate-300"
                                  : "text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              Saldo Aktual
                            </p>
                            <p
                              className={`mt-0.5 font-mono text-xl font-bold tabular-nums ${
                                isBankHero
                                  ? "text-[#E6C768]"
                                  : "text-[#101827] dark:text-white"
                              }`}
                            >
                              {formatIDR(acc.current_balance)}
                            </p>
                            <p
                              className={`mt-1 font-mono text-[11px] tabular-nums ${
                                isBankHero
                                  ? "text-slate-400"
                                  : "text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              Saldo awal: {formatIDR(acc.opening_balance)}
                            </p>
                          </div>

                          <div className="relative z-10 mt-4 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedAccount(acc)}
                              className={`ego-pressable flex-1 min-h-[42px] rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                                isBankHero
                                  ? "bg-white/12 text-white hover:bg-white/20"
                                  : "border border-slate-200 bg-slate-50 text-[#101827] hover:bg-slate-100 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:hover:bg-[#162032]"
                              }`}
                            >
                              Riwayat Akun
                            </button>
                            {acc.is_active ? (
                              <button
                                type="button"
                                aria-label={`Catat pengeluaran dari ${acc.account_name}`}
                                onClick={() =>
                                  openTransactionSheet({
                                    type: "expense",
                                    sourceAccountId: acc.id,
                                  })
                                }
                                className="ego-pressable inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-3 py-1.5 text-xs font-semibold text-[#101827] hover:brightness-105"
                              >
                                <Plus className="h-4 w-4" aria-hidden="true" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </EgoStaggerSection>
        )}
      </div>

      {/* Add Account ModalSheet */}
      <ModalSheet
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Tambah Akun Baru"
        subtitle="Daftarkan rekening bank, e-wallet, atau dompet tunai Anda."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="acc-name"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Nama Akun{" "}
              <span className="text-[#DC2626] dark:text-[#F87171]">*</span>
            </label>
            <input
              id="acc-name"
              type="text"
              required
              maxLength={80}
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Contoh: BCA Utama / GoPay / Dompet"
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] placeholder:text-slate-400 focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#D4AF37]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="acc-type"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Jenis Akun
            </label>
            <select
              id="acc-type"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as AccountType)}
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:focus:border-[#D4AF37]"
            >
              <option value="bank">Bank</option>
              <option value="ewallet">E-Wallet</option>
              <option value="cash">Tunai</option>
            </select>
          </div>

          <MoneyInput
            id="acc-opening"
            label="Saldo Awal (IDR)"
            value={openingBalance}
            onChange={setOpeningBalance}
          />

          <ApprovalCheck
            id="acc-owner-confirm"
            checked={ownerConfirmed}
            onChange={setOwnerConfirmed}
          />

          <button
            type="submit"
            disabled={!ownerConfirmed || createAccount.isPending}
            className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2.5 text-sm font-semibold text-[#101827] shadow-sm transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 dark:disabled:from-[#162032] dark:disabled:to-[#162032] dark:disabled:text-slate-500"
          >
            {createAccount.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            <span>Simpan Akun</span>
          </button>
        </form>
      </ModalSheet>

      {/* Account Transaction History ModalSheet */}
      <ModalSheet
        open={Boolean(selectedAccount)}
        onClose={() => setSelectedAccount(null)}
        title={selectedAccount ? selectedAccount.account_name : "Riwayat Akun"}
        subtitle={
          selectedAccount
            ? `${accountTypeLabel(selectedAccount.account_type)} · Saldo ${formatIDR(
                selectedAccount.current_balance
              )}`
            : undefined
        }
      >
        {selectedAccount ? (
          <div className="space-y-4">
            {selectedAccountTx.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-600 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-400">
                Belum ada mutasi tercatat untuk akun ini.
              </div>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-[#1E293B]">
                {selectedAccountTx.map((tx) => {
                  const isCancelled = tx.status === "cancelled";
                  const incoming =
                    tx.destination_account_id === selectedAccount.id;
                  return (
                    <li
                      key={tx.id}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            incoming
                              ? "bg-[#14B8A6]/12 text-[#0D9488] dark:bg-[#14B8A6]/15 dark:text-[#2DD4BF]"
                              : "bg-[#EF4444]/10 text-[#DC2626] dark:bg-[#EF4444]/15 dark:text-[#F87171]"
                          }`}
                        >
                          <CategoryIcon
                            category={tx.category}
                            transactionType={tx.transaction_type}
                            className="h-4 w-4"
                          />
                        </span>
                        <div className="min-w-0">
                          <p
                            className={`truncate text-xs font-semibold ${
                              isCancelled
                                ? "text-slate-400 line-through"
                                : "text-[#101827] dark:text-white"
                            }`}
                          >
                            {tx.description || tx.category || "Mutasi"}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {formatDateID(tx.transaction_date, dateFormat)} ·{" "}
                            {tx.category || "Umum"}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 font-mono text-xs font-bold tabular-nums ${
                          isCancelled
                            ? "text-slate-400 line-through"
                            : incoming
                              ? "text-[#0D9488] dark:text-[#2DD4BF]"
                              : "text-[#DC2626] dark:text-[#F87171]"
                        }`}
                      >
                        {incoming ? "+" : "-"}
                        {formatIDR(tx.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            <Link
              to="/transaksi"
              search={{ akun: selectedAccount.id }}
              onClick={() => setSelectedAccount(null)}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2.5 text-xs font-semibold text-[#101827] hover:brightness-105"
            >
              <span>Lihat Semua Transaksi Akun Ini</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        ) : null}
      </ModalSheet>
    </AppShell>
  );
}
