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
import { ApprovalCheck } from "../../components/ego/approval-check";
import { AccountTypeIcon, CategoryIcon } from "../../components/ego/category-icon";
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
      subtitle="Kartu rekening bank, e-wallet, dan dompet tunai dengan pantauan saldo aktual."
      action={
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-[#087BFF]/20 hover:brightness-110 whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Tambah Akun</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Liquidity Hero Banner */}
        <section className="ego-card-hero flex flex-col justify-between gap-4 rounded-3xl border border-[#1B3163] p-5 text-white shadow-lg shadow-[#06132F]/15 sm:flex-row sm:items-center sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#C7D0E0]/80">
              Total Likuiditas Aktif
            </p>
            <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-white sm:text-3xl">
              {formatIDR(totalLiquidity)}
            </p>
            <p className="mt-1 text-xs text-[#C7D0E0]/80">
              {accounts.filter((a) => a.is_active).length} akun aktif ·{" "}
              {accounts.filter((a) => !a.is_active).length} diarsipkan
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openTransactionSheet({ type: "transfer" })}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#19D8FF]/35 bg-[#19D8FF]/15 px-4 py-2 text-xs font-semibold text-[#19D8FF] transition-colors hover:bg-[#19D8FF]/25"
            >
              <span>Transfer Antar-Akun</span>
            </button>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#087BFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0666DB]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Akun Baru</span>
            </button>
          </div>
        </section>

        {/* Banking Card Grids */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((k) => (
              <div
                key={k}
                className="h-44 animate-pulse rounded-2xl border border-[#DCE4F0] bg-white dark:border-[#1B3163] dark:bg-[#091634]"
              />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#DCE4F0] bg-white p-10 text-center dark:border-[#1B3163] dark:bg-[#091634]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
              <Wallet className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="mt-3.5 text-base font-bold text-[#06132F] dark:text-white">
              Belum Ada Akun Keuangan
            </h2>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-600 dark:text-[#C7D0E0]/75">
              Daftarkan rekening bank, e-wallet, atau kas tunai pertama Anda untuk mulai melacak saldo secara real-time.
            </p>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="mt-4 inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#087BFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0666DB]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tambah Akun Pertama</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {(["bank", "ewallet", "cash"] as const).map((groupType) => {
              const items = grouped[groupType];
              if (items.length === 0) return null;
              return (
                <section key={groupType} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <AccountTypeIcon
                      type={groupType}
                      className="h-4 w-4 text-[#087BFF] dark:text-[#19D8FF]"
                    />
                    <h2 className="text-sm font-bold text-[#06132F] dark:text-white">
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
                          className={`relative overflow-hidden rounded-2xl border p-5 transition-all ${
                            !acc.is_active
                              ? "border-[#DCE4F0] bg-slate-100/80 opacity-75 dark:border-[#1B3163] dark:bg-[#06132F]/70"
                              : isBankHero
                                ? "ego-card-hero border-[#1B3163] text-white shadow-md shadow-[#06132F]/15"
                                : "border-[#DCE4F0] bg-white shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-3">
                              <span
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                  isBankHero
                                    ? "bg-[#19D8FF]/15 text-[#19D8FF]"
                                    : "bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]"
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
                                      : "text-[#06132F] dark:text-white"
                                  }`}
                                >
                                  {acc.account_name}
                                </h3>
                                <p
                                  className={`mt-0.5 text-xs ${
                                    isBankHero
                                      ? "text-[#C7D0E0]/80"
                                      : "text-slate-500 dark:text-[#C7D0E0]/70"
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
                                  ? "border-white/15 bg-white/10 text-[#C7D0E0] hover:bg-white/20 hover:text-white"
                                  : "border-[#DCE4F0] bg-[#F4F7FB] text-slate-600 hover:text-[#06132F] dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]"
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
                            className={`mt-4 border-t pt-3.5 ${
                              isBankHero
                                ? "border-white/12"
                                : "border-[#DCE4F0] dark:border-[#1B3163]"
                            }`}
                          >
                            <p
                              className={`text-[11px] ${
                                isBankHero
                                  ? "text-[#C7D0E0]/75"
                                  : "text-slate-500 dark:text-[#C7D0E0]/70"
                              }`}
                            >
                              Saldo Aktual
                            </p>
                            <p
                              className={`mt-0.5 font-mono text-xl font-bold tabular-nums ${
                                isBankHero
                                  ? "text-white"
                                  : "text-[#06132F] dark:text-white"
                              }`}
                            >
                              {formatIDR(acc.current_balance)}
                            </p>
                            <p
                              className={`mt-1 font-mono text-[11px] tabular-nums ${
                                isBankHero
                                  ? "text-[#C7D0E0]/65"
                                  : "text-slate-500 dark:text-[#C7D0E0]/60"
                              }`}
                            >
                              Saldo awal: {formatIDR(acc.opening_balance)}
                            </p>
                          </div>

                          <div className="mt-4 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedAccount(acc)}
                              className={`flex-1 min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                                isBankHero
                                  ? "bg-white/12 text-white hover:bg-white/20"
                                  : "border border-[#DCE4F0] bg-[#F4F7FB] text-[#06132F] hover:bg-slate-100 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white"
                              }`}
                            >
                              Riwayat Akun
                            </button>
                            {acc.is_active ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openTransactionSheet({
                                    type: "expense",
                                    sourceAccountId: acc.id,
                                  })
                                }
                                className="inline-flex min-h-[38px] items-center justify-center rounded-xl bg-[#087BFF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0666DB]"
                              >
                                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
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
          </div>
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
              className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
            >
              Nama Akun <span className="text-rose-600 dark:text-rose-400">*</span>
            </label>
            <input
              id="acc-name"
              type="text"
              required
              maxLength={80}
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Contoh: BCA Utama / GoPay / Dompet"
              className="min-h-[44px] w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] placeholder:text-slate-400 focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#19D8FF]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="acc-type"
              className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
            >
              Jenis Akun
            </label>
            <select
              id="acc-type"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as AccountType)}
              className="min-h-[44px] w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
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
            className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#087BFF] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0666DB] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-[#122652] dark:disabled:text-slate-500"
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
              <div className="rounded-2xl border border-dashed border-[#DCE4F0] bg-[#F4F7FB] p-6 text-center text-xs text-slate-600 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]/75">
                Belum ada mutasi tercatat untuk akun ini.
              </div>
            ) : (
              <ul className="divide-y divide-[#DCE4F0] dark:divide-[#1B3163]">
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
                              ? "bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]"
                              : "bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
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
                                : "text-[#06132F] dark:text-white"
                            }`}
                          >
                            {tx.description || tx.category || "Mutasi"}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/65">
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
                              ? "text-[#087BFF] dark:text-[#19D8FF]"
                              : "text-rose-600 dark:text-rose-400"
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
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#087BFF] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0666DB]"
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
