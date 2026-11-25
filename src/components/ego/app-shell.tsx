import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Bell,
  BellRing,
  Bot,
  Briefcase,
  Calculator,
  CalendarClock,
  CreditCard,
  FlaskConical,
  Home,
  Lock,
  LogOut,
  Menu,
  PieChart,
  Plus,
  Settings,
  ShieldCheck,
  Target,
  Wallet,
  X,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";
import { summarizeBudgetMonth } from "../../lib/budgets";
import { daysUntilDue, formatIDR, getDueRecurringBills, todayISO } from "../../lib/finance";
import { setPinLocked } from "../../lib/pin-lock";
import { useAuthStatus, useLogoutOwner, useVaultSnapshot } from "../../lib/queries";
import { summarizeRemindersForDashboard } from "../../lib/reminders";
import { ThemeToggleButton } from "../../lib/theme";
import { EgoBrand, EgoLogoMark } from "./ego-brand";
import { ModalSheet } from "./modal-sheet";
import { OfflineIndicator, PWAInstallButton } from "./pwa-controls";
import { useTransactionSheet } from "./transaction-input-sheet";

export type NavTo =
  | "/"
  | "/transaksi"
  | "/akun"
  | "/aset"
  | "/utang"
  | "/rencana"
  | "/pengingat"
  | "/anggaran"
  | "/laporan"
  | "/analitik"
  | "/simulasi"
  | "/owner"
  | "/pengaturan";

interface SidebarNavItem {
  to: NavTo;
  label: string;
  icon: typeof Home;
}

const SIDEBAR_ITEMS: SidebarNavItem[] = [
  { to: "/", label: "Beranda", icon: Home },
  { to: "/transaksi", label: "Transaksi", icon: ArrowLeftRight },
  { to: "/akun", label: "Akun", icon: Wallet },
  { to: "/anggaran", label: "Anggaran", icon: PieChart },
  { to: "/analitik", label: "Analitik & Skor", icon: Activity },
  { to: "/simulasi", label: "Simulasi What-If", icon: FlaskConical },
  { to: "/aset", label: "Aset", icon: Briefcase },
  { to: "/utang", label: "Utang", icon: CreditCard },
  { to: "/rencana", label: "Target & Tagihan", icon: Target },
  { to: "/pengingat", label: "Pengingat", icon: BellRing },
  { to: "/laporan", label: "Laporan", icon: BarChart3 },
  { to: "/owner", label: "Owner AI & Control", icon: Bot },
  { to: "/pengaturan", label: "Pengaturan", icon: Settings },
];

interface AppShellProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function AppShell({ title, subtitle, action, children }: AppShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: auth } = useAuthStatus();
  const { data: vault } = useVaultSnapshot(Boolean(auth?.authenticated));
  const { openTransactionSheet } = useTransactionSheet();
  const logout = useLogoutOwner();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const pendingCommands =
    vault?.owner_commands.filter((c) => c.status === "pending") ?? [];
  const dueBills = getDueRecurringBills(vault?.recurring_bills ?? []);
  const reminderSummary = useMemo(
    () =>
      summarizeRemindersForDashboard(
        vault?.financial_reminders ?? [],
        vault?.recurring_bills ?? [],
        vault?.debts ?? []
      ),
    [vault?.financial_reminders, vault?.recurring_bills, vault?.debts]
  );

  const reminderAlertsCount = useMemo(() => {
    const activeReminders = (vault?.financial_reminders ?? []).filter(
      (r) => r.is_active
    );
    const linkedBillIds = new Set(
      activeReminders.map((r) => r.linked_bill_id).filter(Boolean)
    );
    const unlinkedDueBills = dueBills.filter((b) => !linkedBillIds.has(b.id));
    const unreadOrDueReminders = activeReminders.filter((r) => {
      if (!r.is_read) return true;
      const days = daysUntilDue(r.due_date);
      return days !== null && days <= 0;
    });
    return unreadOrDueReminders.length + unlinkedDueBills.length;
  }, [vault?.financial_reminders, dueBills]);

  const budgetSummary = useMemo(
    () =>
      summarizeBudgetMonth(
        vault?.category_budgets ?? [],
        vault?.transactions ?? [],
        todayISO().slice(0, 7),
        vault?.budget_alert_logs ?? [],
        vault?.recurring_bills ?? [],
        vault?.financial_reminders ?? []
      ),
    [
      vault?.category_budgets,
      vault?.transactions,
      vault?.budget_alert_logs,
      vault?.recurring_bills,
      vault?.financial_reminders,
    ]
  );

  const totalNotifications =
    pendingCommands.length + reminderAlertsCount + budgetSummary.attentionCount;

  const ownerName = auth?.owner?.full_name?.trim() || "Owner Utama";
  const isMenuRouteActive =
    pathname.startsWith("/anggaran") ||
    pathname.startsWith("/analitik") ||
    pathname.startsWith("/simulasi") ||
    pathname.startsWith("/aset") ||
    pathname.startsWith("/utang") ||
    pathname.startsWith("/rencana") ||
    pathname.startsWith("/pengingat") ||
    pathname.startsWith("/laporan") ||
    pathname.startsWith("/owner") ||
    pathname.startsWith("/pengaturan");

  async function handleLogout() {
    setMobileMenuOpen(false);
    await logout.mutateAsync();
    toast.success("Sesi brankas Anda telah ditutup dengan aman.");
    await navigate({ to: "/auth" });
  }

  function handleQuickLock() {
    setMobileMenuOpen(false);
    setPinLocked(true);
    toast.success("Layar brankas dikunci dengan PIN cepat.");
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#06132F] transition-colors duration-200 dark:bg-[#040B1C] dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[#DCE4F0] bg-white dark:border-[#1B3163] dark:bg-[#06132F] md:flex">
        <div className="flex h-16 items-center border-b border-[#DCE4F0] px-5 dark:border-[#1B3163]">
          <EgoBrand size="md" showSubtitle />
        </div>

        <div className="px-3.5 pt-4 pb-2">
          <button
            type="button"
            onClick={() => openTransactionSheet()}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#087BFF]/20 transition-all hover:brightness-110 active:scale-[0.99]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Catat Transaksi</span>
          </button>
        </div>

        <nav aria-label="Navigasi Utama" className="flex-1 space-y-1 overflow-y-auto px-3.5 py-2">
          {SIDEBAR_ITEMS.map((item) => {
            const active =
              item.to === "/"
                ? pathname === "/"
                : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex min-h-[40px] items-center justify-between rounded-xl px-3.5 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? "bg-[#087BFF]/10 font-semibold text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]"
                    : "text-slate-600 hover:bg-[#F4F7FB] hover:text-[#06132F] dark:text-[#C7D0E0]/75 dark:hover:bg-[#0D1E45] dark:hover:text-white"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active
                        ? "text-[#087BFF] dark:text-[#19D8FF]"
                        : "text-slate-400 dark:text-[#C7D0E0]/60"
                    }`}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </span>
                {item.to === "/owner" && pendingCommands.length > 0 ? (
                  <span className="rounded-md bg-[#087BFF]/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#087BFF] dark:bg-[#19D8FF]/20 dark:text-[#19D8FF] tabular-nums">
                    {pendingCommands.length}
                  </span>
                ) : item.to === "/pengingat" && reminderAlertsCount > 0 ? (
                  <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                    {reminderAlertsCount}
                  </span>
                ) : item.to === "/anggaran" && budgetSummary.attentionCount > 0 ? (
                  <span className="rounded-md bg-rose-500/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                    {budgetSummary.attentionCount}
                  </span>
                ) : item.to === "/rencana" && dueBills.length > 0 ? (
                  <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                    {dueBills.length}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2.5 border-t border-[#DCE4F0] p-4 dark:border-[#1B3163]">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-medium text-slate-500 dark:text-[#C7D0E0]/70">
              Tema
            </span>
            <ThemeToggleButton />
          </div>

          <PWAInstallButton fullWidth />

          <div className="border-t border-[#DCE4F0] pt-2.5 px-1 dark:border-[#1B3163]">
            <p className="text-[11px] font-medium text-slate-500 dark:text-[#C7D0E0]/70">
              Pemilik Brankas
            </p>
            <p className="truncate text-sm font-semibold text-[#06132F] dark:text-white">
              {ownerName}
            </p>
          </div>

          {auth?.hasPin ? (
            <button
              type="button"
              onClick={handleQuickLock}
              className="flex min-h-[38px] w-full items-center gap-2.5 rounded-xl border border-[#087BFF]/25 bg-[#087BFF]/8 px-3.5 py-2 text-xs font-semibold text-[#087BFF] transition-colors hover:bg-[#087BFF]/15 dark:border-[#19D8FF]/30 dark:bg-[#19D8FF]/10 dark:text-[#19D8FF] dark:hover:bg-[#19D8FF]/20"
            >
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Kunci Layar (PIN)</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleLogout}
            disabled={logout.isPending}
            className="flex min-h-[38px] w-full items-center gap-2.5 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-[#06132F] dark:border-[#1B3163] dark:bg-[#091634] dark:text-[#C7D0E0] dark:hover:bg-[#0D1E45] dark:hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5 text-slate-500 dark:text-[#C7D0E0]/70" aria-hidden="true" />
            <span>Kunci &amp; Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="md:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-20 border-b border-[#DCE4F0] bg-white/90 backdrop-blur-md dark:border-[#1B3163] dark:bg-[#06132F]/90">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Link to="/" className="shrink-0 md:hidden" aria-label="Beranda EGO Personal AI">
                <EgoLogoMark size="sm" />
              </Link>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold tracking-tight text-[#06132F] dark:text-white sm:text-xl">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="hidden truncate text-xs text-slate-600 dark:text-[#C7D0E0]/75 sm:block">
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {action ? <div className="hidden sm:block">{action}</div> : null}

              <button
                type="button"
                onClick={() => setNotifOpen(true)}
                aria-label={
                  totalNotifications > 0
                    ? `Notifikasi (${totalNotifications} item)`
                    : "Notifikasi"
                }
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] text-[#06132F] transition-colors hover:border-[#087BFF]/40 hover:bg-[#087BFF]/8 dark:border-[#1B3163] dark:bg-[#091634] dark:text-[#C7D0E0] dark:hover:border-[#19D8FF]/50 dark:hover:text-white"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                {totalNotifications > 0 ? (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#087BFF] px-1 font-mono text-[10px] font-bold text-white shadow-xs">
                    {totalNotifications}
                  </span>
                ) : null}
              </button>

              <Link
                to="/owner"
                aria-label="Owner Control dan Pengaturan"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3 text-xs font-semibold text-[#06132F] transition-colors hover:border-[#087BFF]/40 hover:bg-[#087BFF]/8 dark:border-[#1B3163] dark:bg-[#091634] dark:text-white dark:hover:border-[#19D8FF]/50"
              >
                <ShieldCheck className="h-4 w-4 text-[#087BFF] dark:text-[#19D8FF]" aria-hidden="true" />
                <span className="hidden sm:inline">Owner Control</span>
              </Link>
            </div>
          </div>
          {action ? (
            <div className="border-t border-[#DCE4F0]/70 px-4 py-2 dark:border-[#1B3163]/70 sm:hidden">
              {action}
            </div>
          ) : null}
        </header>

        <main className="mx-auto max-w-6xl px-4 pt-5 pb-28 sm:px-6 sm:pt-6 md:pb-14 lg:px-8">
          {children}
        </main>
      </div>

      {/* Notifications Sheet */}
      <ModalSheet
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        title="Notifikasi Brankas"
        subtitle="Pantauan antrean persetujuan AI dan jadwal tagihan mendatang."
      >
        <div className="space-y-5">
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#C7D0E0]/70">
                Antrean Persetujuan AI ({pendingCommands.length})
              </h3>
              <Link
                to="/owner"
                onClick={() => setNotifOpen(false)}
                className="text-xs font-semibold text-[#087BFF] hover:underline dark:text-[#19D8FF]"
              >
                Buka Owner Control
              </Link>
            </div>
            {pendingCommands.length === 0 ? (
              <p className="rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-3 text-xs text-slate-600 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]/75">
                Tidak ada draf AI yang menunggu persetujuan.
              </p>
            ) : (
              <ul className="space-y-2">
                {pendingCommands.slice(0, 4).map((cmd) => (
                  <li key={cmd.id}>
                    <Link
                      to="/owner"
                      onClick={() => setNotifOpen(false)}
                      className="block rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-xs transition-colors hover:border-[#087BFF]/40 dark:border-[#1B3163] dark:bg-[#06132F]"
                    >
                      <p className="truncate font-semibold text-[#06132F] dark:text-white">
                        &ldquo;{cmd.command_text}&rdquo;
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#087BFF] dark:text-[#19D8FF]">
                        Menunggu tinjauan &amp; konfirmasi Owner
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#C7D0E0]/70">
                Pengingat Keuangan ({reminderSummary.totalActiveCount})
              </h3>
              <Link
                to="/pengingat"
                onClick={() => setNotifOpen(false)}
                className="text-xs font-semibold text-[#087BFF] hover:underline dark:text-[#19D8FF]"
              >
                Pusat Pengingat
              </Link>
            </div>
            {reminderSummary.nearestReminder ? (
              <Link
                to="/pengingat"
                onClick={() => setNotifOpen(false)}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-xs transition-colors hover:border-[#087BFF]/40 dark:border-[#1B3163] dark:bg-[#06132F]"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#06132F] dark:text-white">
                    {reminderSummary.nearestReminder.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                    {reminderSummary.nearestReminder.daysRemaining === null
                      ? reminderSummary.nearestReminder.dueDate
                      : reminderSummary.nearestReminder.daysRemaining < 0
                        ? `Terlambat ${Math.abs(reminderSummary.nearestReminder.daysRemaining)} hari`
                        : reminderSummary.nearestReminder.daysRemaining === 0
                          ? "Jatuh tempo hari ini"
                          : `${reminderSummary.nearestReminder.daysRemaining} hari lagi`}{" "}
                    · {reminderSummary.overdueCount} terlambat
                  </p>
                </div>
                <span className="shrink-0 font-mono font-bold text-[#087BFF] dark:text-[#19D8FF] tabular-nums">
                  {formatIDR(reminderSummary.nearestReminder.amount)}
                </span>
              </Link>
            ) : (
              <p className="rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-3 text-xs text-slate-600 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]/75">
                Belum ada pengingat keuangan aktif.
              </p>
            )}
          </div>

          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#C7D0E0]/70">
                Tagihan Jatuh Tempo ≤ 7 Hari ({dueBills.length})
              </h3>
              <Link
                to="/rencana"
                search={{ tab: "tagihan" }}
                onClick={() => setNotifOpen(false)}
                className="text-xs font-semibold text-[#087BFF] hover:underline dark:text-[#19D8FF]"
              >
                Kelola Tagihan
              </Link>
            </div>
            {dueBills.length === 0 ? (
              <p className="rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-3 text-xs text-slate-600 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]/75">
                Tidak ada tagihan mendesak dalam 7 hari ke depan.
              </p>
            ) : (
              <ul className="space-y-2">
                {dueBills.slice(0, 4).map((bill) => {
                  const delta = daysUntilDue(bill.next_due_date);
                  return (
                    <li key={bill.id}>
                      <Link
                        to="/rencana"
                        search={{ tab: "tagihan" }}
                        onClick={() => setNotifOpen(false)}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-xs transition-colors hover:border-[#087BFF]/40 dark:border-[#1B3163] dark:bg-[#06132F]"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#06132F] dark:text-white">
                            {bill.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                            {delta !== null
                              ? delta < 0
                                ? `Terlambat ${Math.abs(delta)} hari`
                                : delta === 0
                                  ? "Jatuh tempo hari ini"
                                  : `${delta} hari lagi`
                              : bill.next_due_date}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                          {formatIDR(bill.amount)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#C7D0E0]/70">
                Peringatan Anggaran ({budgetSummary.attentionCount})
              </h3>
              <Link
                to="/anggaran"
                onClick={() => setNotifOpen(false)}
                className="text-xs font-semibold text-[#087BFF] hover:underline dark:text-[#19D8FF]"
              >
                Smart Budget Monitor
              </Link>
            </div>
            {budgetSummary.alertCategories.length === 0 ? (
              <p className="rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-3 text-xs text-slate-600 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]/75">
                Seluruh kategori anggaran aktif masih berada di bawah ambang 75%.
              </p>
            ) : (
              <ul className="space-y-2">
                {budgetSummary.alertCategories.slice(0, 4).map((bItem) => (
                  <li key={bItem.budget.id}>
                    <Link
                      to="/anggaran"
                      onClick={() => setNotifOpen(false)}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-xs transition-colors hover:border-[#087BFF]/40 dark:border-[#1B3163] dark:bg-[#06132F]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#06132F] dark:text-white">
                          {bItem.budget.category}
                        </p>
                        <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                          {bItem.severityLabel}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                        {bItem.usagePct.toFixed(0)}%
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </ModalSheet>

      {/* Mobile Drawer Sheet for "Menu" */}
      {mobileMenuOpen ? (
        <div
          className="fixed inset-0 z-40 bg-[#06132F]/60 backdrop-blur-xs dark:bg-black/75 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu Tambahan EGO"
            className="absolute inset-x-0 bottom-16 max-h-[82vh] overflow-y-auto rounded-t-3xl border-t border-[#DCE4F0] bg-white p-5 pb-6 shadow-2xl dark:border-[#1B3163] dark:bg-[#091634]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 dark:bg-[#233E7A]" />
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <EgoLogoMark size="sm" />
                <div>
                  <p className="text-sm font-bold text-[#06132F] dark:text-white">
                    Menu Brankas EGO
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
                    {ownerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Tutup menu"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-[#06132F] dark:text-[#C7D0E0] dark:hover:bg-[#0D1E45] dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {(
                [
                  { to: "/analitik", label: "Analitik & Skor", icon: Activity, badge: 0 },
                  { to: "/simulasi", label: "What-If", icon: FlaskConical, badge: 0 },
                  { to: "/anggaran", label: "Anggaran", icon: PieChart, badge: budgetSummary.attentionCount },
                  { to: "/pengingat", label: "Pengingat", icon: BellRing, badge: reminderAlertsCount },
                  {
                    to: "/rencana",
                    search: { tab: "simulator" as const },
                    label: "Sim. Target",
                    icon: Calculator,
                    badge: 0,
                  },
                  { to: "/aset", label: "Aset", icon: Briefcase, badge: 0 },
                  { to: "/utang", label: "Utang", icon: CreditCard, badge: 0 },
                  {
                    to: "/rencana",
                    search: { tab: "target" as const },
                    label: "Target",
                    icon: Target,
                    badge: 0,
                  },
                  {
                    to: "/rencana",
                    search: { tab: "tagihan" as const },
                    label: "Tagihan",
                    icon: CalendarClock,
                    badge: dueBills.length,
                  },
                  { to: "/laporan", label: "Laporan", icon: BarChart3, badge: 0 },
                  {
                    to: "/owner",
                    search: { tab: "ai" as const },
                    label: "Owner AI",
                    icon: Bot,
                    badge: 0,
                  },
                  {
                    to: "/owner",
                    search: { tab: "control" as const },
                    label: "Owner Control",
                    icon: ShieldCheck,
                    badge: pendingCommands.length,
                  },
                  { to: "/pengaturan", label: "Pengaturan", icon: Settings, badge: 0 },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    search={"search" in item ? item.search : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex min-h-[48px] items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                      active
                        ? "border-[#087BFF]/40 bg-[#087BFF]/10 text-[#087BFF] dark:border-[#19D8FF]/45 dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]"
                        : "border-[#DCE4F0] bg-[#F4F7FB] text-[#06132F] dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge > 0 ? (
                      <span className="rounded-md bg-[#087BFF] px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 dark:border-[#1B3163] dark:bg-[#06132F]">
              <span className="text-xs font-semibold text-[#06132F] dark:text-[#C7D0E0]">
                Mode Tampilan
              </span>
              <ThemeToggleButton />
            </div>

            <div className="mt-3">
              <PWAInstallButton fullWidth />
            </div>

            {auth?.hasPin ? (
              <button
                type="button"
                onClick={handleQuickLock}
                className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-[#087BFF]/30 bg-[#087BFF]/10 px-4 py-2.5 text-sm font-semibold text-[#087BFF] dark:border-[#19D8FF]/35 dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]"
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
                <span>Kunci Layar (PIN)</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleLogout}
              className="mt-2.5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Kunci &amp; Keluar</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Mobile Bottom Navigation (5 items: Home, Transaksi, +, Akun, Menu) */}
      <nav
        aria-label="Navigasi Mobile"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 items-center border-t border-[#DCE4F0] bg-white/95 px-1 backdrop-blur-md dark:border-[#1B3163] dark:bg-[#06132F]/95 md:hidden"
      >
        <Link
          to="/"
          className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
            pathname === "/"
              ? "text-[#087BFF] dark:text-[#19D8FF]"
              : "text-slate-500 dark:text-[#C7D0E0]/65"
          }`}
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          <span>Home</span>
        </Link>

        <Link
          to="/transaksi"
          className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
            pathname.startsWith("/transaksi")
              ? "text-[#087BFF] dark:text-[#19D8FF]"
              : "text-slate-500 dark:text-[#C7D0E0]/65"
          }`}
        >
          <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
          <span>Transaksi</span>
        </Link>

        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => openTransactionSheet()}
            aria-label="Catat Transaksi Baru"
            className="flex h-12 w-12 -mt-4 items-center justify-center rounded-2xl bg-gradient-to-br from-[#19D8FF] via-[#087BFF] to-[#0055CC] text-white shadow-lg shadow-[#087BFF]/35 ring-4 ring-white transition-transform active:scale-95 dark:ring-[#06132F]"
          >
            <Plus className="h-6 w-6 stroke-[2.5]" aria-hidden="true" />
          </button>
        </div>

        <Link
          to="/akun"
          className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
            pathname.startsWith("/akun")
              ? "text-[#087BFF] dark:text-[#19D8FF]"
              : "text-slate-500 dark:text-[#C7D0E0]/65"
          }`}
        >
          <Wallet className="h-4 w-4" aria-hidden="true" />
          <span>Akun</span>
        </Link>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-expanded={mobileMenuOpen}
          className={`relative flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
            mobileMenuOpen || isMenuRouteActive
              ? "text-[#087BFF] dark:text-[#19D8FF]"
              : "text-slate-500 dark:text-[#C7D0E0]/65"
          }`}
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
          <span>Menu</span>
          {totalNotifications > 0 ? (
            <span
              className="absolute top-2.5 right-4 h-2 w-2 rounded-full bg-[#087BFF] dark:bg-[#19D8FF]"
              aria-hidden="true"
            />
          ) : null}
        </button>
      </nav>

      <OfflineIndicator />
    </div>
  );
}
