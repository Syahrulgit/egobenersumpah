import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  CalendarClock,
  CalendarPlus,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Edit3,
  History,
  Info,
  Loader2,
  Pause,
  PiggyBank,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../../components/ego/app-shell";
import { ApprovalCheck } from "../../components/ego/approval-check";
import {
  EgoCountUp,
  EgoStaggerSection,
} from "../../components/ego/ego-motion";
import { ModalSheet } from "../../components/ego/modal-sheet";
import { MoneyInput } from "../../components/ego/money-input";
import { formatDateID, formatIDR, todayISO } from "../../lib/finance";
import {
  useCreateReminder,
  useDeleteReminder,
  useMarkAllRemindersRead,
  useMarkReminderRead,
  useQueueReminderDraft,
  useSyncRemindersFromSources,
  useUpdateReminder,
  useVaultSnapshot,
} from "../../lib/queries";
import {
  REMINDER_CATEGORIES,
  REMINDER_OFFSET_OPTIONS,
  buildSourceSyncReminders,
  detectPwaNotificationCapabilities,
  evaluateReminder,
  filterEvaluatedReminders,
  generateReminderIcs,
  reminderCategoryMeta,
  reminderFrequencyLabel,
  type ReminderStatusFilter,
} from "../../lib/reminders";
import type {
  FinancialReminder,
  ReminderCategory,
  ReminderFrequency,
  TransactionType,
} from "../../types/ego";

type PengingatTab = "ringkasan" | "pembayaran" | "tabungan" | "riwayat";

const MIGRATION_HINT_SQL =
  "Jalankan skrip docs/ego-supabase-reminders-migration.sql pada SQL Editor Supabase untuk mengaktifkan tabel financial_reminders dan financial_reminder_logs.";

export function PengingatPage() {
  const { data: vault, isLoading } = useVaultSnapshot(true);
  const createReminder = useCreateReminder();
  const updateReminder = useUpdateReminder();
  const deleteReminder = useDeleteReminder();
  const markRead = useMarkReminderRead();
  const markAllRead = useMarkAllRemindersRead();
  const queueDraft = useQueueReminderDraft();
  const syncSources = useSyncRemindersFromSources();

  const accounts = vault?.accounts ?? [];
  const activeAccounts = accounts.filter((a) => a.is_active);
  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );
  const reminders = vault?.financial_reminders ?? [];
  const logs = vault?.financial_reminder_logs ?? [];
  const bills = vault?.recurring_bills ?? [];
  const debts = vault?.debts ?? [];
  const dateFormat = vault?.preferences.date_format ?? "DD MMM YYYY";
  const remindersTableReady = vault?.remindersTableReady !== false;

  const [activeTab, setActiveTab] = useState<PengingatTab>("ringkasan");
  const [categoryFilter, setCategoryFilter] = useState<ReminderCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ReminderStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllReminders, setShowAllReminders] = useState(false);
  const [notifCapVersion, setNotifCapVersion] = useState(0);

  // Create / Edit modal state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<FinancialReminder | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState<ReminderCategory>("tagihan_bulanan");
  const [formTxType, setFormTxType] = useState<TransactionType>("expense");
  const [formAmount, setFormAmount] = useState(0);
  const [formDueDate, setFormDueDate] = useState(todayISO());
  const [formTime, setFormTime] = useState("08:00");
  const [formFrequency, setFormFrequency] = useState<ReminderFrequency>("monthly");
  const [formOffsets, setFormOffsets] = useState<number[]>([7, 3, 1, 0]);
  const [formCustomDays, setFormCustomDays] = useState<string>("");
  const [formAccountId, setFormAccountId] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formConfirmed, setFormConfirmed] = useState(false);

  // Safe Draft Queue confirmation modal
  const [draftTarget, setDraftTarget] = useState<FinancialReminder | null>(null);
  const [draftConfirmed, setDraftConfirmed] = useState(false);
  const [draftAdvanceCycle, setDraftAdvanceCycle] = useState(true);

  const capabilities = useMemo(() => {
    void notifCapVersion;
    return detectPwaNotificationCapabilities();
  }, [notifCapVersion]);

  const evaluatedAll = useMemo(
    () => reminders.map((r) => evaluateReminder(r)),
    [reminders]
  );

  const pendingSyncCount = useMemo(
    () => buildSourceSyncReminders(bills, debts, reminders, "preview").length,
    [bills, debts, reminders]
  );

  const todayItems = useMemo(
    () => evaluatedAll.filter((e) => e.isTodayWindow),
    [evaluatedAll]
  );
  const overdueItems = useMemo(
    () => evaluatedAll.filter((e) => e.isOverdue),
    [evaluatedAll]
  );
  const dueSoonItems = useMemo(
    () => evaluatedAll.filter((e) => e.isDueSoon || e.isDueToday),
    [evaluatedAll]
  );
  const unreadCount = useMemo(
    () => reminders.filter((r) => r.is_active && !r.is_read).length,
    [reminders]
  );

  const paymentItems = useMemo(
    () => filterEvaluatedReminders(evaluatedAll, { status: "payment" }),
    [evaluatedAll]
  );
  const savingsItems = useMemo(
    () =>
      evaluatedAll.filter((e) => {
        const grp = reminderCategoryMeta(e.reminder.reminder_type).group;
        return grp === "savings" || grp === "income";
      }),
    [evaluatedAll]
  );

  const filteredItems = useMemo(() => {
    const tabStatus: ReminderStatusFilter =
      activeTab === "pembayaran"
        ? "payment"
        : statusFilter;

    let base = filterEvaluatedReminders(evaluatedAll, {
      category: categoryFilter,
      status: tabStatus,
      search: searchQuery,
    });

    if (activeTab === "tabungan") {
      base = base.filter((e) => {
        const grp = reminderCategoryMeta(e.reminder.reminder_type).group;
        return grp === "savings" || grp === "income";
      });
    }

    return base;
  }, [evaluatedAll, activeTab, categoryFilter, statusFilter, searchQuery]);

  const visibleItems = showAllReminders ? filteredItems : filteredItems.slice(0, 5);

  function openCreateModal() {
    setEditingReminder(null);
    setFormTitle("");
    setFormCategory("tagihan_bulanan");
    setFormTxType("expense");
    setFormAmount(0);
    setFormDueDate(todayISO());
    setFormTime("08:00");
    setFormFrequency("monthly");
    setFormOffsets([7, 3, 1, 0]);
    setFormCustomDays("");
    setFormAccountId("");
    setFormNotes("");
    setFormConfirmed(false);
    setFormModalOpen(true);
  }

  function openEditModal(r: FinancialReminder) {
    setEditingReminder(r);
    setFormTitle(r.title);
    setFormCategory(r.reminder_type);
    setFormTxType(r.transaction_type);
    setFormAmount(r.amount);
    setFormDueDate(r.due_date.slice(0, 10));
    setFormTime(r.reminder_time || "08:00");
    setFormFrequency(r.frequency);
    setFormOffsets(r.remind_offsets ?? [7, 3, 1, 0]);
    setFormCustomDays(
      r.custom_days_before !== null && r.custom_days_before !== undefined
        ? String(r.custom_days_before)
        : ""
    );
    setFormAccountId(r.linked_account_id ?? "");
    setFormNotes(r.notes ?? "");
    setFormConfirmed(true);
    setFormModalOpen(true);
  }

  function toggleOffsetValue(offset: number) {
    setFormOffsets((prev) =>
      prev.includes(offset) ? prev.filter((x) => x !== offset) : [...prev, offset]
    );
  }

  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!formConfirmed) return;

    const customDays =
      formCustomDays.trim() !== "" ? Number.parseInt(formCustomDays.trim(), 10) : null;

    try {
      if (editingReminder) {
        await updateReminder.mutateAsync({
          id: editingReminder.id,
          title: formTitle.trim(),
          reminder_type: formCategory,
          transaction_type: formTxType,
          amount: formAmount,
          due_date: formDueDate,
          reminder_time: formTime,
          frequency: formFrequency,
          remind_offsets: formOffsets,
          custom_days_before: customDays,
          linked_account_id: formAccountId || null,
          notes: formNotes.trim() || null,
        });
        toast.success(`Pengingat "${formTitle.trim()}" berhasil diperbarui.`);
      } else {
        await createReminder.mutateAsync({
          title: formTitle.trim(),
          reminder_type: formCategory,
          transaction_type: formTxType,
          amount: formAmount,
          due_date: formDueDate,
          reminder_time: formTime,
          frequency: formFrequency,
          remind_offsets: formOffsets,
          custom_days_before: customDays,
          linked_account_id: formAccountId || null,
          notes: formNotes.trim() || null,
          owner_confirmed: true,
        });
        toast.success(`Pengingat "${formTitle.trim()}" berhasil ditambahkan.`);
      }
      setFormModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan pengingat.");
    }
  }

  async function handleRequestBrowserPermission() {
    if (typeof Notification === "undefined") {
      toast.error("Browser perangkat ini tidak mendukung Notification API.");
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setNotifCapVersion((v) => v + 1);
      if (result === "granted") {
        toast.success("Izin notifikasi browser berhasil diaktifkan.");
      } else if (result === "denied") {
        toast.error(
          "Izin notifikasi ditolak browser. Anda tetap menerima notifikasi dalam aplikasi dan dapat mengekspor kalender .ics."
        );
      }
    } catch {
      toast.error("Gagal meminta izin notifikasi browser.");
    }
  }

  async function handleSendTestNotification() {
    toast.info("Uji Notifikasi EGO", {
      description: "Notifikasi dalam aplikasi aktif. Saldo brankas tetap terlindungi.",
    });

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const options: NotificationOptions = {
        body: "Pusat Pengingat Keuangan EGO aktif pada perangkat ini.",
        icon: "/icon-192.png",
        tag: "ego-test-notification",
      };
      if ("serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification("EGO Personal AI · Uji Notifikasi", options);
          return;
        } catch {
          // Fallback to window Notification
        }
      }
      new Notification("EGO Personal AI · Uji Notifikasi", options);
    }
  }

  function handleDownloadIcs(reminder: FinancialReminder) {
    const icsContent = generateReminderIcs(reminder, dateFormat);
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ego-pengingat-${reminder.due_date.slice(0, 10)}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`File kalender .ics untuk "${reminder.title}" berhasil diunduh.`);
  }

  async function handleSyncSources() {
    try {
      const res = await syncSources.mutateAsync({
        bills,
        debts,
        existingReminders: reminders,
      });
      if (res.createdCount > 0) {
        toast.success(`${res.createdCount} pengingat berhasil disinkronkan dari Tagihan & Utang.`);
      } else {
        toast.info("Semua tagihan rutin dan utang aktif sudah memiliki pengingat.");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyinkronkan jadwal dari Tagihan & Utang."
      );
    }
  }

  async function handleConfirmQueueDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!draftTarget || !draftConfirmed) return;
    try {
      await queueDraft.mutateAsync({
        reminder: draftTarget,
        owner_confirmed: true,
        advance_cycle: draftAdvanceCycle,
      });
      toast.success(
        `Draf "${draftTarget.title}" dikirim ke Owner Control. Saldo hanya berubah setelah Anda menyetujuinya di Owner Control.`
      );
      setDraftTarget(null);
      setDraftConfirmed(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mengirim draf ke Owner Control."
      );
    }
  }

  return (
    <AppShell
      title="Financial Reminder"
      subtitle="Pusat pengingat tagihan, cicilan, gaji, setoran tabungan, dan target keuangan."
      action={
        <button
          type="button"
          onClick={openCreateModal}
          className="ego-pressable inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-3.5 py-2 text-xs font-semibold text-[#101827] shadow-sm shadow-[#D4AF37]/20 transition-all hover:brightness-105"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Buat Pengingat</span>
        </button>
      }
    >
      <div className="space-y-6">
        {!remindersTableReady ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-xs text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-bold">Tabel Pengingat Belum Dibuat di Supabase</p>
                <p className="mt-0.5 leading-relaxed">{MIGRATION_HINT_SQL}</p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Top KPI Strip */}
        <EgoStaggerSection index={0}>
        <section className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="ego-card-hero ego-card-hero--living rounded-3xl border border-[#D4AF37]/30 p-5 text-white shadow-lg shadow-[#101827]/15">
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#E6C768]">
                  Pengingat Hari Ini
                </p>
                <BellRing className="h-4 w-4 text-[#E6C768]" aria-hidden="true" />
              </div>
              <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white">
                <EgoCountUp
                  value={todayItems.length}
                  formatter={(v) => `${Math.round(v)} Jadwal`}
                />
              </p>
              <p className="mt-1.5 text-xs text-slate-300">
                {unreadCount} pengingat belum dibaca
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Terlambat &amp; Segera
              </p>
              <AlertTriangle
                className={`h-4 w-4 ${
                  overdueItems.length > 0 ? "text-[#EF4444]" : "text-[#D4AF37]"
                }`}
                aria-hidden="true"
              />
            </div>
            <p
              className={`mt-2 font-mono text-2xl font-bold tabular-nums ${
                overdueItems.length > 0
                  ? "text-[#DC2626] dark:text-[#F87171]"
                  : "text-[#101827] dark:text-white"
              }`}
            >
              <EgoCountUp
                value={overdueItems.length}
                formatter={(v) => `${Math.round(v)} Terlambat`}
              />
            </p>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {dueSoonItems.length} jatuh tempo ≤ 7 hari ke depan
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Jadwal Pembayaran
              </p>
              <CalendarClock className="h-4 w-4 text-[#9A7411] dark:text-[#E6C768]" aria-hidden="true" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#101827] dark:text-white">
              <EgoCountUp
                value={paymentItems.filter((p) => p.reminder.is_active).length}
                formatter={(v) => `${Math.round(v)} Aktif`}
              />
            </p>
            <p className="mt-1.5 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
              Total{" "}
              {formatIDR(
                paymentItems
                  .filter((p) => p.reminder.is_active)
                  .reduce((s, p) => s + p.reminder.amount, 0),
                true
              )}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Setoran Tabungan &amp; Gaji
              </p>
              <PiggyBank className="h-4 w-4 text-[#0D9488] dark:text-[#2DD4BF]" aria-hidden="true" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#101827] dark:text-white">
              <EgoCountUp
                value={savingsItems.filter((s) => s.reminder.is_active).length}
                formatter={(v) => `${Math.round(v)} Jadwal`}
              />
            </p>
            <p className="mt-1.5 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
              Total{" "}
              {formatIDR(
                savingsItems
                  .filter((s) => s.reminder.is_active)
                  .reduce((sum, s) => sum + s.reminder.amount, 0),
                true
              )}
            </p>
          </div>
        </section>
        </EgoStaggerSection>

        <EgoStaggerSection index={1} className="space-y-6">
        {/* Tabs & Sync Actions */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            role="tablist"
            aria-label="Bagian Pusat Pengingat"
            className="flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-[#1E293B] dark:bg-[#101827]"
          >
            {(
              [
                { id: "ringkasan", label: `Semua (${reminders.length})`, icon: Bell },
                { id: "pembayaran", label: `Pembayaran (${paymentItems.length})`, icon: CalendarClock },
                { id: "tabungan", label: `Tabungan & Masuk (${savingsItems.length})`, icon: PiggyBank },
                { id: "riwayat", label: `Riwayat (${logs.length})`, icon: History },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`ego-pressable inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? "bg-[#101827] text-white shadow-xs dark:bg-[#D4AF37] dark:text-[#101827]"
                      : "text-slate-600 hover:text-[#101827] dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {pendingSyncCount > 0 ? (
              <button
                type="button"
                onClick={handleSyncSources}
                disabled={syncSources.isPending}
                className="ego-pressable inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/15 px-3.5 py-2 text-xs font-semibold text-[#9A7411] hover:bg-[#D4AF37]/25 dark:text-[#E6C768]"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${syncSources.isPending ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                <span>Sinkronkan Tagihan &amp; Utang ({pendingSyncCount})</span>
              </button>
            ) : null}

            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="ego-pressable inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#101827] hover:bg-slate-50 dark:border-[#1E293B] dark:bg-[#101827] dark:text-slate-200 dark:hover:bg-[#162032]"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Tandai Semua Dibaca</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Main Content Tab */}
        {activeTab === "riwayat" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#101827] dark:text-white">
                  Riwayat Pengingat ({logs.length})
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Catatan waktu pemicu notifikasi, pembacaan, dan pengajuan draf oleh Owner.
                </p>
              </div>
            </div>

            {logs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-[#1E293B] dark:bg-[#0B111E]/70">
                <History className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
                <p className="mt-2 text-sm font-bold text-[#101827] dark:text-white">
                  Belum ada riwayat pemicu pengingat
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Riwayat tercatat otomatis ketika pengingat jatuh tempo muncul, ditandai dibaca, dijeda, atau dikirim sebagai draf.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-200/80 dark:divide-[#1E293B]">
                {logs.map((log) => (
                  <li
                    key={log.id}
                    className="flex flex-col justify-between gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#101827] dark:text-white">
                        {log.reminder_title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                        {log.notes || log.event_type}
                        {log.scheduled_for
                          ? ` · Jadwal ${formatDateID(log.scheduled_for, dateFormat)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full bg-[#D4AF37]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#9A7411] dark:text-[#E6C768]">
                        {log.event_type === "triggered"
                          ? "Notifikasi Muncul"
                          : log.event_type === "read"
                            ? "Sudah Dibaca"
                            : log.event_type === "draft_queued"
                              ? "Draf Diajukan"
                              : log.event_type === "paused"
                                ? "Dijeda"
                                : log.event_type === "resumed"
                                  ? "Diaktifkan"
                                  : "Dijadwalkan Ulang"}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {formatDateID(log.created_at, dateFormat)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <div className="space-y-5">
            {/* Today & Overdue Highlight Sections on main tab */}
            {activeTab === "ringkasan" && overdueItems.length > 0 ? (
              <section className="rounded-3xl border border-[#EF4444]/30 bg-[#EF4444]/8 p-4 dark:bg-[#EF4444]/10">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-[#991B1B] dark:text-[#FCA5A5]">
                    <AlertTriangle className="h-4 w-4 text-[#DC2626] dark:text-[#F87171]" aria-hidden="true" />
                    <span>Tagihan / Kewajiban Terlambat ({overdueItems.length})</span>
                  </h2>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {overdueItems.slice(0, 4).map(({ reminder, statusText }) => (
                    <div
                      key={reminder.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-[#EF4444]/25 bg-white px-3.5 py-2.5 dark:bg-[#101827]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-[#101827] dark:text-white">
                          {reminder.title}
                        </p>
                        <p className="text-[11px] font-semibold text-[#DC2626] dark:text-[#F87171]">
                          {statusText} · {formatDateID(reminder.due_date, dateFormat)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDraftTarget(reminder);
                          setDraftConfirmed(false);
                          setDraftAdvanceCycle(true);
                        }}
                        className="shrink-0 rounded-lg bg-[#EF4444] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#DC2626]"
                      >
                        Ajukan Bayar
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Filters Bar */}
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none">
              <div className="grid gap-3 md:grid-cols-12">
                <div className="relative md:col-span-5">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama pengingat atau catatan..."
                    aria-label="Cari pengingat keuangan"
                    className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3.5 pl-10 text-xs text-[#101827] placeholder:text-slate-400 focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:placeholder:text-slate-500"
                  />
                </div>

                <div className="md:col-span-4">
                  <select
                    aria-label="Filter kategori pengingat"
                    value={categoryFilter}
                    onChange={(e) =>
                      setCategoryFilter(e.target.value as ReminderCategory | "all")
                    }
                    className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
                  >
                    <option value="all">Semua Kategori (7 Jenis)</option>
                    {REMINDER_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3">
                  <select
                    aria-label="Filter status pengingat"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as ReminderStatusFilter)}
                    className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
                  >
                    <option value="all">Semua Status</option>
                    <option value="due_today">Hari Ini</option>
                    <option value="overdue">Terlambat</option>
                    <option value="due_soon">Segera Jatuh Tempo (≤7 hr)</option>
                    <option value="unread">Belum Dibaca</option>
                    <option value="upcoming">Mendatang</option>
                    <option value="inactive">Nonaktif / Dijeda</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Reminder List */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-[#101827] dark:text-white">
                    {activeTab === "pembayaran"
                      ? "Jadwal Pembayaran & Kewajiban"
                      : activeTab === "tabungan"
                        ? "Jadwal Setoran Tabungan, Target & Pemasukan"
                        : "Daftar Pengingat Keuangan"}{" "}
                    ({filteredItems.length})
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    EGO tidak pernah memotong saldo secara otomatis. Gunakan tombol Ajukan Draf untuk mengirim perintah yang menunggu konfirmasi Anda.
                  </p>
                </div>
              </div>

              {isLoading ? (
                <div className="h-44 animate-pulse rounded-2xl bg-slate-50 dark:bg-[#0B111E]" />
              ) : filteredItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-[#1E293B] dark:bg-[#0B111E]/70">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D4AF37]/15 text-[#9A7411] dark:text-[#E6C768]">
                    <Bell className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-sm font-bold text-[#101827] dark:text-white">
                    {reminders.length === 0
                      ? "Belum ada pengingat keuangan terdaftar"
                      : "Tidak ada pengingat yang sesuai dengan filter"}
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    Buat pengingat tagihan bulanan, cicilan, gaji, atau setoran tabungan dengan jadwal H-7, H-3, H-1, hingga tanggal jatuh tempo.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={openCreateModal}
                      className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2 text-xs font-semibold text-[#101827]"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Buat Pengingat Pertama</span>
                    </button>
                    {pendingSyncCount > 0 ? (
                      <button
                        type="button"
                        onClick={handleSyncSources}
                        className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#101827] hover:bg-slate-50 dark:border-[#1E293B] dark:bg-[#101827] dark:text-white"
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Impor dari Tagihan &amp; Utang ({pendingSyncCount})</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-200/80 dark:divide-[#1E293B]">
                  {visibleItems.map(({ reminder: r, status, allOffsets, statusText }) => {
                    const meta = reminderCategoryMeta(r.reminder_type);
                    const acc = r.linked_account_id ? accountMap.get(r.linked_account_id) : undefined;
                    const statusBadgeCls =
                      status === "inactive"
                        ? "bg-slate-200 text-slate-600 dark:bg-[#162032] dark:text-slate-400"
                        : status === "overdue"
                          ? "bg-[#EF4444]/15 text-[#DC2626] dark:text-[#F87171]"
                          : status === "due_today"
                            ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                            : status === "due_soon"
                              ? "bg-[#D4AF37]/15 text-[#9A7411] dark:text-[#E6C768]"
                              : "bg-slate-100 text-slate-600 dark:bg-[#162032] dark:text-slate-300";

                    return (
                      <div
                        key={r.id}
                        className="flex flex-col justify-between gap-3.5 py-4 first:pt-0 last:pb-0 lg:flex-row lg:items-center"
                      >
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            {r.is_active && !r.is_read ? (
                              <span
                                title="Belum dibaca"
                                className="inline-block h-2 w-2 rounded-full bg-[#D4AF37]"
                              />
                            ) : null}
                            <h3
                              className={`text-sm font-bold ${
                                r.is_active
                                  ? "text-[#101827] dark:text-white"
                                  : "text-slate-400 line-through dark:text-slate-500"
                              }`}
                            >
                              {r.title}
                            </h3>
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-[#162032] dark:text-slate-200">
                              {meta.label}
                            </span>
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusBadgeCls}`}>
                              {statusText}
                            </span>
                            {r.is_active && r.is_read ? (
                              <span className="rounded-full bg-[#14B8A6]/12 px-2 py-0.5 text-[10px] font-semibold text-[#0D9488] dark:text-[#2DD4BF]">
                                Dibaca
                              </span>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-mono font-semibold text-[#101827] dark:text-white">
                              {formatDateID(r.due_date, dateFormat)} · {r.reminder_time || "08:00"}
                            </span>
                            <span>{reminderFrequencyLabel(r.frequency)}</span>
                            <span>
                              Jadwal:{" "}
                              {allOffsets.map((o) => (o === 0 ? "H-0" : `H-${o}`)).join(", ")}
                            </span>
                            {acc ? <span>Akun: {acc.account_name}</span> : null}
                          </div>

                          {r.notes ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {r.notes}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          <span
                            className={`mr-1 font-mono text-sm font-bold tabular-nums ${
                              r.transaction_type === "income"
                                ? "text-[#0D9488] dark:text-[#2DD4BF]"
                                : r.transaction_type === "transfer"
                                  ? "text-[#9A7411] dark:text-[#E6C768]"
                                  : "text-[#DC2626] dark:text-[#F87171]"
                            }`}
                          >
                            {r.transaction_type === "income"
                              ? "+"
                              : r.transaction_type === "expense"
                                ? "-"
                                : "⇄ "}
                            {formatIDR(r.amount)}
                          </span>

                          {r.is_active ? (
                            <button
                              type="button"
                              onClick={() => {
                                setDraftTarget(r);
                                setDraftConfirmed(false);
                                setDraftAdvanceCycle(true);
                              }}
                              className="ego-pressable inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#D4AF37]/15 px-3 py-1.5 text-xs font-semibold text-[#9A7411] hover:bg-[#D4AF37]/25 dark:text-[#E6C768]"
                            >
                              <Send className="h-3 w-3" aria-hidden="true" />
                              <span>Ajukan Draf</span>
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => markRead.mutate({ reminder: r, is_read: !r.is_read })}
                            disabled={markRead.isPending}
                            title={r.is_read ? "Tandai belum dibaca" : "Tandai sudah dibaca"}
                            className="ego-pressable inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-[#101827] hover:bg-slate-200 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-200 dark:hover:bg-[#162032]"
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{r.is_read ? "Dibaca" : "Tandai Baca"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditModal(r)}
                            aria-label={`Ubah pengingat ${r.title}`}
                            className="ego-pressable inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-[#101827] hover:bg-slate-200 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-200 dark:hover:bg-[#162032]"
                          >
                            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadIcs(r)}
                            title="Unduh pengingat ke aplikasi Kalender (.ics)"
                            aria-label={`Ekspor kalender ${r.title}`}
                            className="ego-pressable inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-[#101827] hover:bg-slate-200 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-200 dark:hover:bg-[#162032]"
                          >
                            <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              updateReminder.mutate({
                                id: r.id,
                                is_active: !r.is_active,
                                reminderTitleForLog: r.title,
                                scheduledForLog: r.due_date,
                              })
                            }
                            aria-label={r.is_active ? `Nonaktifkan ${r.title}` : `Aktifkan ${r.title}`}
                            className="ego-pressable inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-[#101827] hover:bg-slate-200 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-200 dark:hover:bg-[#162032]"
                          >
                            {r.is_active ? (
                              <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <Play className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteReminder.mutate(r.id)}
                            disabled={deleteReminder.isPending}
                            aria-label={`Hapus pengingat ${r.title}`}
                            className="ego-pressable inline-flex min-h-[40px] items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium text-[#DC2626] hover:bg-[#EF4444]/10 dark:text-[#F87171]"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {filteredItems.length > 0 ? (
                <div className="mt-4 flex flex-col items-center gap-2 border-t border-slate-200/80 pt-4 dark:border-[#1E293B]">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {showAllReminders
                      ? `${filteredItems.length} pengingat ditampilkan`
                      : `${visibleItems.length} dari ${filteredItems.length} pengingat ditampilkan`}
                  </p>
                  {filteredItems.length > 5 ? (
                    <button
                      type="button"
                      onClick={() => setShowAllReminders((current) => !current)}
                      className="ego-pressable inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-2 text-xs font-semibold text-[#9A7411] transition-colors hover:bg-[#D4AF37]/20 dark:text-[#E6C768]"
                    >
                      {showAllReminders
                        ? "Tampilkan Lebih Sedikit"
                        : `Lihat Semua Pengingat (${filteredItems.length})`}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>
        )}
        </EgoStaggerSection>

        {/* PWA & iOS Notification Capabilities Card (Honest, Zero-Cost) */}
        <section
          aria-label="Sistem Notifikasi & Dukungan Perangkat"
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-[#9A7411] dark:text-[#E6C768]" aria-hidden="true" />
                <h2 className="text-sm font-bold text-[#101827] dark:text-white">
                  Status Sistem Notifikasi &amp; Dukungan PWA / iOS
                </h2>
              </div>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {capabilities.statusSummary}
              </p>

              <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-full bg-[#14B8A6]/15 px-2.5 py-1 font-semibold text-[#0D9488] dark:text-[#2DD4BF]">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  1. Notifikasi Dalam Aplikasi: Aktif
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${
                    capabilities.canBrowserNotify
                      ? "bg-[#D4AF37]/15 text-[#9A7411] dark:text-[#E6C768]"
                      : "bg-slate-200/80 text-slate-700 dark:bg-[#162032] dark:text-slate-300"
                  }`}
                >
                  {capabilities.canBrowserNotify ? (
                    <Bell className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <BellOff className="h-3 w-3" aria-hidden="true" />
                  )}
                  2. Notifikasi Browser/PWA:{" "}
                  {capabilities.permission === "granted"
                    ? "Diizinkan"
                    : capabilities.permission === "denied"
                      ? "Diblokir"
                      : capabilities.permission === "default"
                        ? "Belum Diminta"
                        : "Tidak Didukung"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 font-semibold text-amber-800 dark:text-amber-300">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  3. Push Saat Tertutup: Belum Tersedia (Tanpa Server Push Berbayar)
                </span>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {capabilities.notificationSupported && capabilities.permission !== "granted" ? (
                <button
                  type="button"
                  onClick={handleRequestBrowserPermission}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-3.5 py-2 text-xs font-semibold text-[#101827] hover:brightness-105"
                >
                  <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Aktifkan Notifikasi Browser</span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={handleSendTestNotification}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-[#101827] hover:bg-slate-200 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-200 dark:hover:bg-[#162032]"
              >
                <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Uji Notifikasi</span>
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-600 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-300">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9A7411] dark:text-[#E6C768]" aria-hidden="true" />
            <span>{capabilities.iosExplanation}</span>
          </div>
        </section>
      </div>

      {/* Create / Edit Financial Reminder Modal */}
      <ModalSheet
        open={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        title={editingReminder ? "Ubah Pengingat Keuangan" : "Buat Pengingat Keuangan"}
        subtitle="Atur jadwal H-7, H-3, H-1, H-0, atau hari khusus. Pengingat tidak mendebit saldo otomatis."
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="rem-title"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              Judul Pengingat <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="rem-title"
              type="text"
              required
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Contoh: Listrik PLN / Cicilan KPR / Setoran Dana Darurat"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="rem-category"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Jenis Pengingat
              </label>
              <select
                id="rem-category"
                value={formCategory}
                onChange={(e) => {
                  const val = e.target.value as ReminderCategory;
                  setFormCategory(val);
                  if (!editingReminder) {
                    setFormTxType(reminderCategoryMeta(val).defaultTxType);
                  }
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
              >
                {REMINDER_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="rem-tx-type"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Arah Arus Kas
              </label>
              <select
                id="rem-tx-type"
                value={formTxType}
                onChange={(e) => setFormTxType(e.target.value as TransactionType)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
              >
                <option value="expense">Pengeluaran</option>
                <option value="income">Pemasukan</option>
                <option value="transfer">Setoran / Transfer</option>
              </select>
            </div>
          </div>

          <MoneyInput
            id="rem-amount"
            label="Nominal Perkiraan (IDR)"
            value={formAmount}
            onChange={setFormAmount}
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label
                htmlFor="rem-due-date"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Tanggal Jatuh Tempo
              </label>
              <input
                id="rem-due-date"
                type="date"
                required
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs text-[#101827] dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="rem-time"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Waktu Pengingat
              </label>
              <input
                id="rem-time"
                type="time"
                required
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs text-[#101827] dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="rem-freq"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Perulangan
              </label>
              <select
                id="rem-freq"
                value={formFrequency}
                onChange={(e) => setFormFrequency(e.target.value as ReminderFrequency)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-[#101827] dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
              >
                <option value="once">Sekali</option>
                <option value="weekly">Mingguan</option>
                <option value="monthly">Bulanan</option>
                <option value="yearly">Tahunan</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Jadwal Peringatan Sebelum Jatuh Tempo
            </span>
            <div className="grid grid-cols-2 gap-2">
              {REMINDER_OFFSET_OPTIONS.map((opt) => {
                const checked = formOffsets.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
                      checked
                        ? "border-[#D4AF37]/45 bg-[#D4AF37]/15 text-[#9A7411] dark:text-[#E6C768]"
                        : "border-slate-200 bg-slate-50 text-slate-600 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOffsetValue(opt.value)}
                      className="h-3.5 w-3.5 rounded accent-[#D4AF37]"
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <label
                htmlFor="rem-custom-days"
                className="text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Pengingat khusus Owner (H-n hari):
              </label>
              <input
                id="rem-custom-days"
                type="number"
                min={0}
                max={90}
                placeholder="Contoh: 5"
                value={formCustomDays}
                onChange={(e) => setFormCustomDays(e.target.value)}
                className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-[#101827] dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="rem-account"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Akun Terkait (Opsional)
              </label>
              <select
                id="rem-account"
                value={formAccountId}
                onChange={(e) => setFormAccountId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-[#101827] dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
              >
                <option value="">Tidak ditentukan</option>
                {activeAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="rem-notes"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Catatan (Opsional)
              </label>
              <input
                id="rem-notes"
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Nomor pelanggan / memo"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-[#101827] dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
              />
            </div>
          </div>

          {!editingReminder ? (
            <ApprovalCheck
              id="rem-owner-confirm"
              checked={formConfirmed}
              onChange={setFormConfirmed}
            />
          ) : null}

          <button
            type="submit"
            disabled={!formConfirmed || createReminder.isPending || updateReminder.isPending}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2.5 text-sm font-semibold text-[#101827] shadow-sm shadow-[#D4AF37]/20 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createReminder.isPending || updateReminder.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <span>{editingReminder ? "Simpan Perubahan" : "Simpan Pengingat"}</span>
            )}
          </button>
        </form>
      </ModalSheet>

      {/* Safe Queue Draft Modal (Never Auto-Posts Transactions) */}
      <ModalSheet
        open={Boolean(draftTarget)}
        onClose={() => setDraftTarget(null)}
        title="Ajukan Draf Transaksi dari Pengingat"
        subtitle="Tindakan ini hanya membuat draf menunggu persetujuan di Owner Control."
      >
        {draftTarget ? (
          <form onSubmit={handleConfirmQueueDraft} className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#1E293B] dark:bg-[#0B111E]">
              <p className="font-bold text-[#101827] dark:text-white">{draftTarget.title}</p>
              <p className="mt-1 font-mono text-base font-bold text-[#9A7411] dark:text-[#E6C768]">
                {formatIDR(draftTarget.amount)}
              </p>
              <p className="mt-1 text-slate-600 dark:text-slate-300">
                Jatuh tempo: {formatDateID(draftTarget.due_date, dateFormat)}
              </p>
            </div>

            {draftTarget.frequency !== "once" ? (
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={draftAdvanceCycle}
                  onChange={(e) => setDraftAdvanceCycle(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#D4AF37]"
                />
                <span>Majukan tanggal pengingat otomatis ke siklus berikutnya</span>
              </label>
            ) : null}

            <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              Saldo rekening dan utang Anda TIDAK akan berubah sebelum Anda membuka{" "}
              <Link to="/owner" className="font-bold underline">
                Owner Control
              </Link>{" "}
              dan menyetujui draf secara eksplisit.
            </div>

            <ApprovalCheck
              id="rem-queue-draft-confirm"
              checked={draftConfirmed}
              onChange={setDraftConfirmed}
            />

            <button
              type="submit"
              disabled={!draftConfirmed || queueDraft.isPending}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2.5 text-sm font-semibold text-[#101827] shadow-sm shadow-[#D4AF37]/20 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {queueDraft.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Mengirim Draf...</span>
                </>
              ) : (
                <span>Kirim ke Antrean Owner Control</span>
              )}
            </button>
          </form>
        ) : null}
      </ModalSheet>
    </AppShell>
  );
}
