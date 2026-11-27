import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  ArrowLeft,
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
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { summarizeBudgetMonth } from "../../lib/budgets";
import { daysUntilDue, formatIDR, getDueRecurringBills, todayISO } from "../../lib/finance";
import { setPinLocked } from "../../lib/pin-lock";
import { useAuthStatus, useLogoutOwner, useVaultSnapshot } from "../../lib/queries";
import { summarizeRemindersForDashboard } from "../../lib/reminders";
import { ThemeToggleButton } from "../../lib/theme";
import { EgoBrand, EgoCompanion, EgoLogoMark } from "./ego-brand";
import {
  EGO_EASE,
  getRouteOrderIndex,
  triggerSignatureFeedback,
} from "./ego-motion";
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

interface ShellMeta {
  title: string;
  subtitle?: string;
}

interface AppShellContextValue {
  setMeta: (meta: ShellMeta) => void;
  desktopActionHost: HTMLDivElement | null;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

export function AppShellFrame({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: auth } = useAuthStatus();
  const { data: vault } = useVaultSnapshot(Boolean(auth?.authenticated));
  const { openTransactionSheet } = useTransactionSheet();
  const logout = useLogoutOwner();
  const navigate = useNavigate();

  const [meta, setMeta] = useState<ShellMeta>({
    title: "EGO Personal AI",
    subtitle: undefined,
  });
  const [desktopActionHost, setDesktopActionHost] = useState<HTMLDivElement | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const isBackPendingRef = useRef(false);
  const lastCommittedPathRef = useRef(pathname);
  const scrollMapRef = useRef<Map<string, number>>(new Map());
  const latestScrollYRef = useRef(0);

  const [routeMotion, setRouteMotion] = useState<{
    current: string;
    direction: 1 | -1;
  }>({
    current: pathname,
    direction: 1,
  });

  if (routeMotion.current !== pathname) {
    const prevIdx = getRouteOrderIndex(routeMotion.current);
    const nextIdx = getRouteOrderIndex(pathname);
    const direction: 1 | -1 = isBackPendingRef.current
      ? -1
      : nextIdx < prevIdx
        ? -1
        : 1;
    setRouteMotion({ current: pathname, direction });
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => {
      latestScrollYRef.current = window.scrollY;
    };
    const onPopState = () => {
      isBackPendingRef.current = true;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  // Close mobile menu on route transition and preserve/restore scroll cleanly on Back
  useLayoutEffect(() => {
    setMobileMenuOpen(false);
    if (typeof window === "undefined") return;
    const prevPath = lastCommittedPathRef.current;
    if (prevPath !== pathname) {
      scrollMapRef.current.set(prevPath, latestScrollYRef.current);
      lastCommittedPathRef.current = pathname;
      if (isBackPendingRef.current) {
        const savedScroll = scrollMapRef.current.get(pathname) ?? 0;
        window.scrollTo({ top: savedScroll, behavior: "auto" });
      } else {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
      isBackPendingRef.current = false;
    }
  }, [pathname]);

  const contextValue = useMemo(
    () => ({
      setMeta,
      desktopActionHost,
    }),
    [desktopActionHost]
  );

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
    <AppShellContext.Provider value={contextValue}>
      <div className="min-h-screen bg-[#F6F7FB] text-[#101827] transition-colors duration-200 dark:bg-[#0B111E] dark:text-slate-100">
        {/* Persistent Desktop Sidebar — Midnight Navy Luxury Rail */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/10 bg-[#101827] text-slate-100 md:flex">
          <div className="flex h-16 items-center border-b border-white/10 px-5">
            <EgoBrand size="md" showSubtitle variant="navy" />
          </div>

          <div className="px-3.5 pt-4 pb-2">
            <button
              type="button"
              onClick={(e) => {
                triggerSignatureFeedback(e.currentTarget, "action", {
                  clientX: e.clientX,
                  clientY: e.clientY,
                });
                openTransactionSheet();
              }}
              className="ego-pressable ego-icon-action flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E6C768] to-[#D4AF37] px-4 py-2.5 text-sm font-bold text-[#101827] shadow-sm transition-all hover:brightness-105 whitespace-nowrap"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
              <span>Catat Transaksi</span>
            </button>
          </div>

          <nav
            aria-label="Navigasi Utama"
            className="flex-1 space-y-1 overflow-y-auto px-3.5 py-2"
          >
            {SIDEBAR_ITEMS.map((item) => {
              const active =
                item.to === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.to);
              const isAiRoute = item.to === "/owner";
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  onClick={(e) => {
                    triggerSignatureFeedback(
                      e.currentTarget,
                      isAiRoute ? "ai" : "nav",
                      { clientX: e.clientX, clientY: e.clientY }
                    );
                  }}
                  className={`ego-nav-item ${isAiRoute ? "ego-icon-ai" : "ego-icon-nav"} relative flex min-h-[40px] items-center justify-between rounded-xl px-3.5 py-2 text-sm font-medium whitespace-nowrap ${
                    active
                      ? isAiRoute
                        ? "text-[#FF9EEA]"
                        : "font-semibold text-[#E6C768]"
                      : "text-slate-300/85 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId="ego-desktop-nav-active"
                      transition={{ duration: 0.22, ease: EGO_EASE }}
                      className={`pointer-events-none absolute inset-0 rounded-xl ${
                        isAiRoute
                          ? "bg-[#FF4DDE]/14 ring-1 ring-[#FF4DDE]/35"
                          : "bg-[#D4AF37]/14 ring-1 ring-[#D4AF37]/30"
                      }`}
                      aria-hidden="true"
                    />
                  ) : null}
                  {active ? (
                    <motion.span
                      layoutId="ego-desktop-nav-rail"
                      transition={{ duration: 0.22, ease: EGO_EASE }}
                      className={`pointer-events-none absolute top-2 bottom-2 left-0 w-1 rounded-r-full ${
                        isAiRoute ? "bg-[#FF4DDE]" : "bg-[#D4AF37]"
                      }`}
                      aria-hidden="true"
                    />
                  ) : null}

                  <span className="relative z-10 flex items-center gap-3">
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-transform duration-150 ${
                        active
                          ? isAiRoute
                            ? "text-[#FF4DDE]"
                            : "text-[#D4AF37]"
                          : isAiRoute
                            ? "text-[#FF4DDE]/80"
                            : "text-slate-400"
                      }`}
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                  </span>
                  {item.to === "/owner" && pendingCommands.length > 0 ? (
                    <span className="relative z-10 rounded-md border border-[#FF4DDE]/35 bg-[#FF4DDE]/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#FF9EEA] tabular-nums">
                      {pendingCommands.length}
                    </span>
                  ) : item.to === "/pengingat" && reminderAlertsCount > 0 ? (
                    <span className="relative z-10 rounded-md bg-[#D4AF37]/20 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#E6C768] tabular-nums">
                      {reminderAlertsCount}
                    </span>
                  ) : item.to === "/anggaran" && budgetSummary.attentionCount > 0 ? (
                    <span className="relative z-10 rounded-md bg-[#EF4444]/20 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#FCA5A5] tabular-nums">
                      {budgetSummary.attentionCount}
                    </span>
                  ) : item.to === "/rencana" && dueBills.length > 0 ? (
                    <span className="relative z-10 rounded-md bg-[#D4AF37]/20 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#E6C768] tabular-nums">
                      {dueBills.length}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="space-y-2.5 border-t border-white/10 p-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-medium text-slate-400">
                Tema
              </span>
              <ThemeToggleButton />
            </div>

            <PWAInstallButton fullWidth />

            <div className="border-t border-white/10 px-1 pt-2.5">
              <p className="text-[11px] font-medium text-slate-400">
                Pemilik Brankas
              </p>
              <p className="truncate text-sm font-semibold text-white">
                {ownerName}
              </p>
            </div>

            {auth?.hasPin ? (
              <button
                type="button"
                onClick={handleQuickLock}
                className="ego-pressable flex min-h-[40px] w-full items-center gap-2.5 rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-3.5 py-2 text-xs font-semibold text-[#E6C768] transition-colors hover:bg-[#D4AF37]/20 whitespace-nowrap"
              >
                <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Kunci Layar (PIN)</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleLogout}
              disabled={logout.isPending}
              className="ego-pressable flex min-h-[40px] w-full items-center gap-2.5 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.09] hover:text-white whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <span>Kunci &amp; Keluar</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="md:pl-64">
          {/* Persistent Top Header */}
          <header className="ego-pwa-header sticky top-0 z-[70] isolate border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-[#1E293B] dark:bg-[#101827]/95">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-2.5 px-4 py-2.5 sm:px-6 sm:py-3 lg:px-8">
              <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                {pathname !== "/" ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      triggerSignatureFeedback(e.currentTarget, "back", {
                        clientX: e.clientX,
                        clientY: e.clientY,
                      });
                      isBackPendingRef.current = true;
                      const historyIndex = window.history.state?.__TSR_index;
                      if (typeof historyIndex === "number" && historyIndex > 0) {
                        window.history.back();
                      } else {
                        void navigate({ to: "/" });
                      }
                    }}
                    className="ego-pressable ego-icon-back inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-[#101827] transition-colors hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/10 md:min-h-[40px] dark:border-[#1E293B] dark:bg-[#162032] dark:text-slate-100 dark:hover:border-[#D4AF37]/50 dark:hover:text-white"
                    aria-label="Kembali ke halaman sebelumnya"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    <span>Kembali</span>
                  </button>
                ) : (
                  <Link
                    to="/"
                    className="inline-flex shrink-0 items-center md:hidden"
                    aria-label="Beranda EGO Personal AI"
                  >
                    <EgoLogoMark size="sm" />
                  </Link>
                )}
                <div className="min-w-0">
                  <h1 className="truncate text-base font-bold tracking-tight text-[#101827] dark:text-white sm:text-xl">
                    {meta.title}
                  </h1>
                  {meta.subtitle ? (
                    <p className="hidden truncate text-xs text-slate-600 dark:text-slate-300/75 sm:block">
                      {meta.subtitle}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="relative z-10 flex shrink-0 items-center gap-2">
                <div ref={setDesktopActionHost} className="hidden sm:block" />

                <button
                  type="button"
                  onClick={(e) => {
                    triggerSignatureFeedback(e.currentTarget, "notif", {
                      clientX: e.clientX,
                      clientY: e.clientY,
                    });
                    setNotifOpen(true);
                  }}
                  aria-label={
                    totalNotifications > 0
                      ? `Notifikasi (${totalNotifications} item)`
                      : "Notifikasi"
                  }
                  className="ego-pressable ego-icon-notif relative z-10 flex h-11 w-11 touch-manipulation items-center justify-center rounded-xl border border-slate-200 bg-white text-[#101827] transition-colors hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/10 md:h-10 md:w-10 dark:border-[#1E293B] dark:bg-[#162032] dark:text-slate-200 dark:hover:border-[#D4AF37]/50 dark:hover:text-white"
                >
                  <Bell className="h-4 w-4" aria-hidden="true" />
                  {totalNotifications > 0 ? (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#EF4444] px-1 font-mono text-[10px] font-bold text-white shadow-xs">
                      {totalNotifications}
                    </span>
                  ) : null}
                </button>

                <Link
                  to="/owner"
                  onClick={(e) => {
                    triggerSignatureFeedback(e.currentTarget, "ai", {
                      clientX: e.clientX,
                      clientY: e.clientY,
                    });
                  }}
                  aria-label="Owner Control dan Pengaturan"
                  aria-current={pathname.startsWith("/owner") ? "page" : undefined}
                  className={`ego-pressable ego-icon-ai relative z-10 inline-flex h-11 touch-manipulation items-center gap-2 rounded-xl border px-3 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 md:h-10 ${
                    pathname.startsWith("/owner")
                      ? "border-[#FF4DDE]/65 bg-[#162032] ring-1 ring-[#FF4DDE]/30"
                      : "border-[#D4AF37]/30 bg-[#101827] hover:border-[#FF4DDE]/50 hover:bg-[#162032]"
                  }`}
                >
                  <ShieldCheck className="h-4 w-4 text-[#FF4DDE]" aria-hidden="true" />
                  <span className="hidden sm:inline">Owner Control</span>
                </Link>
              </div>
            </div>
          </header>

          {/* Cinematic Page Viewport (480ms directional slide, scale depth, fade & gold sweep) */}
          <main className="ego-page-main relative isolate mx-auto max-w-6xl overflow-x-clip px-4 pt-4 pb-28 sm:px-6 sm:pt-6 md:pb-14 lg:px-8">
            <motion.div
              key={pathname}
              initial={{
                opacity: 0,
                x: routeMotion.direction * 26,
                scale: 0.988,
              }}
              animate={{
                opacity: 1,
                x: 0,
                scale: 1,
              }}
              transition={{
                duration: 0.48,
                ease: EGO_EASE,
              }}
              className={`ego-page-content relative z-10 ${
                routeMotion.direction < 0 ? "ego-page-content--back" : ""
              }`}
            >
              {children}
            </motion.div>
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
                <h3 className="text-xs font-bold tracking-wide text-slate-500 dark:text-slate-400">
                  Antrean Persetujuan AI ({pendingCommands.length})
                </h3>
                <Link
                  to="/owner"
                  onClick={() => setNotifOpen(false)}
                  className="text-xs font-semibold text-[#A21CAF] hover:underline dark:text-[#FF4DDE]"
                >
                  Buka Owner Control
                </Link>
              </div>
              {pendingCommands.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs text-slate-600 dark:border-[#1E293B] dark:bg-[#101827] dark:text-slate-300/80">
                  Tidak ada draf AI yang menunggu persetujuan.
                </p>
              ) : (
                <ul className="space-y-2">
                  {pendingCommands.slice(0, 4).map((cmd) => (
                    <li key={cmd.id}>
                      <Link
                        to="/owner"
                        onClick={() => setNotifOpen(false)}
                        className="block rounded-xl border border-[#FF4DDE]/25 bg-slate-50 px-3.5 py-2.5 text-xs transition-colors hover:border-[#FF4DDE]/50 dark:border-[#FF4DDE]/30 dark:bg-[#101827]"
                      >
                        <p className="truncate font-semibold text-[#101827] dark:text-white">
                          &ldquo;{cmd.command_text}&rdquo;
                        </p>
                        <p className="mt-0.5 text-[11px] font-medium text-[#A21CAF] dark:text-[#FF9EEA]">
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
                <h3 className="text-xs font-bold tracking-wide text-slate-500 dark:text-slate-400">
                  Pengingat Keuangan ({reminderSummary.totalActiveCount})
                </h3>
                <Link
                  to="/pengingat"
                  onClick={() => setNotifOpen(false)}
                  className="text-xs font-semibold text-[#9A7411] hover:underline dark:text-[#D4AF37]"
                >
                  Pusat Pengingat
                </Link>
              </div>
              {reminderSummary.nearestReminder ? (
                <Link
                  to="/pengingat"
                  onClick={() => setNotifOpen(false)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs transition-colors hover:border-[#D4AF37]/50 dark:border-[#1E293B] dark:bg-[#101827]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#101827] dark:text-white">
                      {reminderSummary.nearestReminder.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#9A7411] dark:text-[#E6C768]">
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
                  <span className="shrink-0 font-mono font-bold text-[#9A7411] dark:text-[#E6C768] tabular-nums">
                    {formatIDR(reminderSummary.nearestReminder.amount)}
                  </span>
                </Link>
              ) : (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs text-slate-600 dark:border-[#1E293B] dark:bg-[#101827] dark:text-slate-300/80">
                  Belum ada pengingat keuangan aktif.
                </p>
              )}
            </div>

            <div>
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="text-xs font-bold tracking-wide text-slate-500 dark:text-slate-400">
                  Tagihan Jatuh Tempo ≤ 7 Hari ({dueBills.length})
                </h3>
                <Link
                  to="/rencana"
                  search={{ tab: "tagihan" }}
                  onClick={() => setNotifOpen(false)}
                  className="text-xs font-semibold text-[#9A7411] hover:underline dark:text-[#D4AF37]"
                >
                  Kelola Tagihan
                </Link>
              </div>
              {dueBills.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs text-slate-600 dark:border-[#1E293B] dark:bg-[#101827] dark:text-slate-300/80">
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
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs transition-colors hover:border-[#D4AF37]/50 dark:border-[#1E293B] dark:bg-[#101827]"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[#101827] dark:text-white">
                              {bill.title}
                            </p>
                            <p className="mt-0.5 text-[11px] text-[#9A7411] dark:text-[#E6C768]">
                              {delta !== null
                                ? delta < 0
                                  ? `Terlambat ${Math.abs(delta)} hari`
                                  : delta === 0
                                    ? "Jatuh tempo hari ini"
                                    : `${delta} hari lagi`
                                : bill.next_due_date}
                            </p>
                          </div>
                          <span className="shrink-0 font-mono font-bold text-[#DC2626] dark:text-[#F87171] tabular-nums">
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
                <h3 className="text-xs font-bold tracking-wide text-slate-500 dark:text-slate-400">
                  Peringatan Anggaran ({budgetSummary.attentionCount})
                </h3>
                <Link
                  to="/anggaran"
                  onClick={() => setNotifOpen(false)}
                  className="text-xs font-semibold text-[#9A7411] hover:underline dark:text-[#D4AF37]"
                >
                  Smart Budget Monitor
                </Link>
              </div>
              {budgetSummary.alertCategories.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs text-slate-600 dark:border-[#1E293B] dark:bg-[#101827] dark:text-slate-300/80">
                  Seluruh kategori anggaran aktif masih berada di bawah ambang 75%.
                </p>
              ) : (
                <ul className="space-y-2">
                  {budgetSummary.alertCategories.slice(0, 4).map((bItem) => (
                    <li key={bItem.budget.id}>
                      <Link
                        to="/anggaran"
                        onClick={() => setNotifOpen(false)}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs transition-colors hover:border-[#EF4444]/45 dark:border-[#1E293B] dark:bg-[#101827]"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#101827] dark:text-white">
                            {bItem.budget.category}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#9A7411] dark:text-[#E6C768]">
                            {bItem.severityLabel}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono font-bold text-[#DC2626] dark:text-[#F87171] tabular-nums">
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

        {/* Animated Mobile Drawer Sheet for "Menu" — preserves all 13 destinations */}
        <AnimatePresence>
          {mobileMenuOpen ? (
            <motion.div
              key="mobile-menu-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: EGO_EASE }}
              className="fixed inset-0 z-40 bg-[#101827]/70 backdrop-blur-xs dark:bg-black/80 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            >
              <motion.div
                key="mobile-menu-sheet"
                role="dialog"
                aria-modal="true"
                aria-label="Menu Tambahan EGO"
                initial={{ opacity: 0, y: 36 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 28 }}
                transition={{ duration: 0.22, ease: EGO_EASE }}
                className="absolute inset-x-0 bottom-16 max-h-[82vh] overflow-y-auto rounded-t-3xl border-t border-[#D4AF37]/25 bg-white p-5 pb-6 shadow-2xl dark:border-white/10 dark:bg-[#101827]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <EgoLogoMark size="sm" />
                    <div>
                      <p className="text-sm font-bold text-[#101827] dark:text-white">
                        Menu Brankas EGO
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {ownerName}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Tutup menu"
                    onClick={() => setMobileMenuOpen(false)}
                    className="ego-pressable flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-[#101827] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mb-4 overflow-hidden rounded-2xl border border-[#D4AF37]/25 bg-gradient-to-br from-[#101827] via-[#17243A] to-[#101827] p-4 text-white shadow-lg shadow-[#101827]/10">
                  <div className="relative flex min-h-12 items-center justify-center">
                    <div className="absolute left-0 flex h-10 w-10 shrink-0 items-center justify-center">
                      <EgoCompanion size="sm" mode="idle" />
                    </div>
                    <p className="px-11 text-center text-base font-bold tracking-tight">Pusat Kendali EGO</p>
                    <div className="absolute right-0 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 shadow-inner shadow-[#D4AF37]/10">
                      <ShieldCheck className="h-5 w-5 text-[#E6C768]" aria-hidden="true" />
                    </div>
                  </div>
                                  </div>

                {(
                  [
                    {
                      title: "KEUANGAN & INSIGHT",
                                            items: [
                        { to: "/anggaran", label: "Anggaran", icon: PieChart, badge: budgetSummary.attentionCount, tone: "gold" },
                        { to: "/analitik", label: "Analitik & Skor", icon: Activity, badge: 0, tone: "blue" },
                        { to: "/simulasi", label: "What-If", icon: FlaskConical, badge: 0, tone: "violet" },
                        { to: "/laporan", label: "Laporan", icon: BarChart3, badge: 0, tone: "emerald" },
                      ],
                    },
                    {
                      title: "ASET & KEWAJIBAN",
                                            items: [
                        { to: "/aset", label: "Aset", icon: Briefcase, badge: 0, tone: "emerald" },
                        { to: "/utang", label: "Utang", icon: CreditCard, badge: 0, tone: "rose" },
                        { to: "/rencana", search: { tab: "simulator" as const }, label: "Sim. Target", icon: Calculator, badge: 0, tone: "violet" },
                        { to: "/rencana", search: { tab: "target" as const }, label: "Target", icon: Target, badge: 0, tone: "gold" },
                        { to: "/rencana", search: { tab: "tagihan" as const }, label: "Tagihan", icon: CalendarClock, badge: dueBills.length, tone: "rose" },
                      ],
                    },
                    {
                      title: "ASISTEN & SISTEM",
                                            items: [
                        { to: "/pengingat", label: "Pengingat", icon: BellRing, badge: reminderAlertsCount, tone: "gold" },
                        { to: "/owner", search: { tab: "ai" as const }, label: "Owner AI", icon: Bot, badge: 0, tone: "ai" },
                        { to: "/owner", search: { tab: "control" as const }, label: "Owner Control", icon: ShieldCheck, badge: pendingCommands.length, tone: "ai" },
                        { to: "/pengaturan", label: "Pengaturan", icon: Settings, badge: 0, tone: "slate" },
                      ],
                    },
                  ] as const
                ).map((group) => (
                  <section key={group.title} className="mb-4">
                    <div className="mb-2.5 flex items-end justify-between gap-2 px-0.5">
                      <p className="text-[10px] font-extrabold tracking-[0.16em] text-[#9A7411] dark:text-[#E6C768]">{group.title}</p>
                      <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">{group.items.length.toString().padStart(2, "0")}</span>
                    </div>
                    <div className={`grid ${group.title === "ASET & KEWAJIBAN" ? "grid-cols-3 gap-1.5" : "grid-cols-4 gap-1.5"}`}>
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active = pathname.startsWith(item.to);
                        const isAiItem = item.tone === "ai";
                        const toneClass =
                          item.tone === "gold" ? "border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#9A7411] dark:text-[#E6C768]" :
                          item.tone === "blue" ? "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300" :
                          item.tone === "violet" ? "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300" :
                          item.tone === "emerald" ? "border-[#14B8A6]/25 bg-[#14B8A6]/10 text-[#0F766E] dark:text-[#5EEAD4]" :
                          item.tone === "rose" ? "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300" :
                          item.tone === "ai" ? "border-[#FF4DDE]/30 bg-[#FF4DDE]/10 text-[#C026A5] dark:text-[#FF9EEA]" :
                          "border-slate-300/70 bg-slate-200/70 text-slate-600 dark:border-slate-600/40 dark:bg-slate-700/30 dark:text-slate-300";
                        return (
                          <Link
                            key={item.label}
                            to={item.to}
                            search={"search" in item ? item.search : undefined}
                            aria-current={active ? "page" : undefined}
                            onClick={(e) => {
                              triggerSignatureFeedback(e.currentTarget, isAiItem ? "ai" : "nav", {
                                clientX: e.clientX,
                                clientY: e.clientY,
                              });
                              setMobileMenuOpen(false);
                            }}
                            className={`ego-nav-item group relative flex h-full min-h-[72px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border p-1.5 text-center transition-all duration-200 active:scale-[0.97] ${
                              active
                                ? isAiItem
                                  ? "border-[#FF4DDE]/55 bg-[#FF4DDE]/10 shadow-[0_5px_18px_rgba(255,77,222,0.10)] dark:bg-[#FF4DDE]/15"
                                  : "border-[#D4AF37]/55 bg-[#D4AF37]/10 shadow-[0_5px_18px_rgba(212,175,55,0.10)] dark:bg-[#D4AF37]/15"
                                : "border-slate-200 bg-white shadow-sm shadow-slate-900/[0.025] hover:-translate-y-0.5 hover:border-[#D4AF37]/35 hover:shadow-md dark:border-[#263449] dark:bg-[#162032]"
                            }`}
                          >
                            {item.label === "Tagihan" ? (
                              <span className="flex h-11 items-center justify-center gap-2">
                                <span className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${toneClass}`}>
                                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                                  {active ? <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-white bg-[#D4AF37] dark:border-[#162032]" /> : null}
                                </span>
                                <span className="flex h-9 w-8 shrink-0 items-center justify-center overflow-visible">
                                  <EgoCompanion size="sm" mode="idle" className="scale-[0.72]" />
                                </span>
                              </span>
                            ) : (
                              <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${toneClass}`}>
                                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                                {active ? <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-white bg-[#D4AF37] dark:border-[#162032]" /> : null}
                              </span>
                            )}
                            <span className="w-full min-w-0 flex-none self-center text-center">
                              <span className={`block line-clamp-2 break-words text-[9px] font-bold leading-tight ${active ? isAiItem ? "text-[#C026A5] dark:text-[#FF9EEA]" : "text-[#85620A] dark:text-[#E6C768]" : "text-[#101827] dark:text-slate-100"}`}>{item.label}</span>
                            </span>
                            {item.badge > 0 ? (
                              <span className={`absolute ${item.label === "Tagihan" ? "left-1/2 -translate-x-1/2" : "right-2"} top-2 rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold tabular-nums ${isAiItem ? "bg-[#FF4DDE] text-white" : "bg-[#101827] text-[#E6C768] dark:bg-[#D4AF37] dark:text-[#101827]"}`}>
                                {item.badge}
                              </span>
                            ) : null}
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ))}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="flex min-h-[38px] items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-[#1E293B] dark:bg-[#162032]">
                    <span className="text-[9px] font-semibold leading-none text-[#101827] dark:text-slate-200">
                      Mode Tampilan
                    </span>
                    <ThemeToggleButton compact />
                  </div>

                  <PWAInstallButton className="!flex-col !min-w-0 !min-h-[38px] !h-auto !w-full !gap-0.5 !whitespace-normal !rounded-lg !px-1.5 !py-1.5 !text-center !text-[9px] !leading-tight [&>span]:whitespace-normal" />

                  {auth?.hasPin ? (
                    <button
                      type="button"
                      onClick={handleQuickLock}
                      className="ego-pressable flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/12 px-2 py-2 text-[11px] font-semibold leading-tight text-[#85620A] dark:border-[#D4AF37]/40 dark:bg-[#D4AF37]/15 dark:text-[#E6C768]"
                    >
                      <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>Kunci Layar (PIN)</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={logout.isPending}
                    className="ego-pressable flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#EF4444]/25 bg-[#EF4444]/10 px-2 py-2 text-[11px] font-semibold leading-tight text-[#DC2626] dark:border-[#EF4444]/30 dark:bg-[#EF4444]/12 dark:text-[#FCA5A5]"
                  >
                    <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Kunci &amp; Keluar</span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Persistent Mobile Bottom Navigation (5 items: Home, Transaksi, +, Akun, Menu) */}
        <nav
          aria-label="Navigasi Mobile"
          className="pb-safe fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 items-center border-t border-white/10 bg-[#101827]/95 px-1 backdrop-blur-md md:hidden"
        >
          <Link
            to="/"
            onClick={(e) => {
              triggerSignatureFeedback(e.currentTarget, "nav", {
                clientX: e.clientX,
                clientY: e.clientY,
              });
            }}
            aria-current={pathname === "/" ? "page" : undefined}
            className={`ego-nav-item ego-icon-nav relative flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
              pathname === "/" ? "text-[#E6C768]" : "text-slate-400 hover:text-white"
            }`}
          >
            {pathname === "/" ? (
              <motion.span
                layoutId="ego-mobile-nav-active"
                transition={{ duration: 0.26, ease: EGO_EASE }}
                className="pointer-events-none absolute top-0 left-1/2 h-0.5 w-7 -translate-x-1/2 rounded-b-full bg-[#D4AF37] shadow-[0_1px_6px_rgba(212,175,55,0.45)]"
                aria-hidden="true"
              />
            ) : null}
            <Home className="h-4 w-4" aria-hidden="true" />
            <span>Home</span>
          </Link>

          <Link
            to="/transaksi"
            onClick={(e) => {
              triggerSignatureFeedback(e.currentTarget, "nav", {
                clientX: e.clientX,
                clientY: e.clientY,
              });
            }}
            aria-current={pathname.startsWith("/transaksi") ? "page" : undefined}
            className={`ego-nav-item ego-icon-nav relative flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
              pathname.startsWith("/transaksi")
                ? "text-[#E6C768]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {pathname.startsWith("/transaksi") ? (
              <motion.span
                layoutId="ego-mobile-nav-active"
                transition={{ duration: 0.26, ease: EGO_EASE }}
                className="pointer-events-none absolute top-0 left-1/2 h-0.5 w-7 -translate-x-1/2 rounded-b-full bg-[#D4AF37] shadow-[0_1px_6px_rgba(212,175,55,0.45)]"
                aria-hidden="true"
              />
            ) : null}
            <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
            <span>Transaksi</span>
          </Link>

          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={(e) => {
                triggerSignatureFeedback(e.currentTarget, "action", {
                  clientX: e.clientX,
                  clientY: e.clientY,
                });
                openTransactionSheet();
              }}
              aria-label="Catat Transaksi Baru"
              className="ego-pressable ego-icon-action -mt-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F1D57A] via-[#D4AF37] to-[#B8941F] text-[#101827] shadow-lg shadow-[#101827]/40 ring-4 ring-[#F6F7FB] dark:ring-[#0B111E]"
            >
              <Plus className="h-6 w-6 stroke-[2.5]" aria-hidden="true" />
            </button>
          </div>

          <Link
            to="/akun"
            onClick={(e) => {
              triggerSignatureFeedback(e.currentTarget, "nav", {
                clientX: e.clientX,
                clientY: e.clientY,
              });
            }}
            aria-current={pathname.startsWith("/akun") ? "page" : undefined}
            className={`ego-nav-item ego-icon-nav relative flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
              pathname.startsWith("/akun")
                ? "text-[#E6C768]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {pathname.startsWith("/akun") ? (
              <motion.span
                layoutId="ego-mobile-nav-active"
                transition={{ duration: 0.26, ease: EGO_EASE }}
                className="pointer-events-none absolute top-0 left-1/2 h-0.5 w-7 -translate-x-1/2 rounded-b-full bg-[#D4AF37] shadow-[0_1px_6px_rgba(212,175,55,0.45)]"
                aria-hidden="true"
              />
            ) : null}
            <Wallet className="h-4 w-4" aria-hidden="true" />
            <span>Akun</span>
          </Link>

          <button
            type="button"
            onClick={(e) => {
              triggerSignatureFeedback(e.currentTarget, "toggle", {
                clientX: e.clientX,
                clientY: e.clientY,
              });
              setMobileMenuOpen((v) => !v);
            }}
            aria-expanded={mobileMenuOpen}
            className={`ego-nav-item ego-icon-toggle relative flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
              mobileMenuOpen || isMenuRouteActive
                ? "text-[#E6C768]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {isMenuRouteActive && !mobileMenuOpen ? (
              <motion.span
                layoutId="ego-mobile-nav-active"
                transition={{ duration: 0.26, ease: EGO_EASE }}
                className="pointer-events-none absolute top-0 left-1/2 h-0.5 w-7 -translate-x-1/2 rounded-b-full bg-[#D4AF37] shadow-[0_1px_6px_rgba(212,175,55,0.45)]"
                aria-hidden="true"
              />
            ) : null}
            <Menu className="h-4 w-4" aria-hidden="true" />
            <span>Menu</span>
            {totalNotifications > 0 ? (
              <span
                className="absolute top-2.5 right-4 h-2 w-2 rounded-full bg-[#EF4444]"
                aria-hidden="true"
              />
            ) : null}
          </button>
        </nav>

        <OfflineIndicator />
      </div>
    </AppShellContext.Provider>
  );
}

interface AppShellProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Syncs page header metadata (`title`, `subtitle`, `action`) into the persistent
 * `AppShellFrame` rendered in `_authenticated/route.tsx`, keeping the sidebar, header,
 * and mobile bottom bar continuously mounted across all 13 routes.
 */
export function AppShell({ title, subtitle, action, children }: AppShellProps) {
  const ctx = useContext(AppShellContext);

  useLayoutEffect(() => {
    if (!ctx) return;
    ctx.setMeta({ title, subtitle });
  }, [ctx, title, subtitle]);

  if (!ctx) {
    // Fallback when rendered standalone outside AuthenticatedLayout
    return (
      <AppShellFrame>
        {action ? <div className="mb-4 sm:hidden">{action}</div> : null}
        {children}
      </AppShellFrame>
    );
  }

  return (
    <>
      {action && ctx.desktopActionHost
        ? createPortal(action, ctx.desktopActionHost)
        : null}
      {action ? <div className="mb-4 sm:hidden">{action}</div> : null}
      {children}
    </>
  );
}
