import { advanceDueDate, daysUntilDue, formatDateID, formatIDR, todayISO } from "./finance";
import type {
  DateFormatPref,
  Debt,
  FinancialReminder,
  RecurringBill,
  ReminderCategory,
  ReminderFrequency,
  ReminderStatusKind,
} from "../types/ego";

export interface ReminderCategoryMeta {
  value: ReminderCategory;
  label: string;
  shortLabel: string;
  defaultTxType: "income" | "expense" | "transfer";
  group: "payment" | "income" | "savings";
}

export const REMINDER_CATEGORIES: ReminderCategoryMeta[] = [
  {
    value: "tagihan_bulanan",
    label: "Tagihan Bulanan",
    shortLabel: "Tagihan",
    defaultTxType: "expense",
    group: "payment",
  },
  {
    value: "cicilan_utang",
    label: "Cicilan & Utang",
    shortLabel: "Cicilan",
    defaultTxType: "expense",
    group: "payment",
  },
  {
    value: "jatuh_tempo",
    label: "Tanggal Jatuh Tempo",
    shortLabel: "Jatuh Tempo",
    defaultTxType: "expense",
    group: "payment",
  },
  {
    value: "tanggal_gajian",
    label: "Tanggal Gajian",
    shortLabel: "Gajian",
    defaultTxType: "income",
    group: "income",
  },
  {
    value: "setoran_tabungan",
    label: "Setoran Tabungan Rutin",
    shortLabel: "Tabungan",
    defaultTxType: "transfer",
    group: "savings",
  },
  {
    value: "target_keuangan",
    label: "Target Keuangan",
    shortLabel: "Target",
    defaultTxType: "transfer",
    group: "savings",
  },
  {
    value: "pemasukan_rutin",
    label: "Pemasukan Rutin",
    shortLabel: "Pemasukan",
    defaultTxType: "income",
    group: "income",
  },
];

export const REMINDER_OFFSET_OPTIONS: Array<{ value: 7 | 3 | 1 | 0; label: string; shortLabel: string }> = [
  { value: 7, label: "H-7 sebelum jatuh tempo", shortLabel: "H-7" },
  { value: 3, label: "H-3 sebelum jatuh tempo", shortLabel: "H-3" },
  { value: 1, label: "H-1 sebelum jatuh tempo", shortLabel: "H-1" },
  { value: 0, label: "Pada hari jatuh tempo", shortLabel: "H-0" },
];

export function reminderCategoryMeta(category: ReminderCategory): ReminderCategoryMeta {
  return (
    REMINDER_CATEGORIES.find((c) => c.value === category) ?? {
      value: "tagihan_bulanan",
      label: "Tagihan Bulanan",
      shortLabel: "Tagihan",
      defaultTxType: "expense",
      group: "payment",
    }
  );
}

export function reminderFrequencyLabel(freq: ReminderFrequency): string {
  switch (freq) {
    case "once":
      return "Sekali";
    case "weekly":
      return "Mingguan";
    case "monthly":
      return "Bulanan";
    case "yearly":
      return "Tahunan";
  }
}

export function currentTimeHHMM(now = new Date()): string {
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function advanceReminderDueDate(
  dueDateISO: string,
  frequency: ReminderFrequency
): string {
  if (frequency === "once") {
    return dueDateISO.slice(0, 10);
  }
  return advanceDueDate(dueDateISO, frequency);
}

export function buildReminderNotificationKey(
  reminderId: string,
  dueDate: string,
  offset: number
): string {
  return `${reminderId}:${dueDate.slice(0, 10)}:H${offset}`;
}

export function buildReminderDedupeKey(
  kind: "bill" | "debt" | "goal",
  sourceId: string
): string {
  return `${kind}:${sourceId}`;
}

export function normalizeReminderOffsets(
  offsets: number[],
  customDaysBefore: number | null | undefined
): number[] {
  const set = new Set<number>();
  for (const val of offsets) {
    if (Number.isInteger(val) && val >= 0 && val <= 90) {
      set.add(val);
    }
  }
  if (
    customDaysBefore !== null &&
    customDaysBefore !== undefined &&
    Number.isInteger(customDaysBefore) &&
    customDaysBefore >= 0 &&
    customDaysBefore <= 90
  ) {
    set.add(customDaysBefore);
  }
  return Array.from(set).sort((a, b) => b - a);
}

export interface EvaluatedReminder {
  reminder: FinancialReminder;
  daysRemaining: number | null;
  status: ReminderStatusKind;
  allOffsets: number[];
  matchedOffset: number | null;
  notificationKey: string | null;
  shouldNotifyNow: boolean;
  isDueToday: boolean;
  isTodayWindow: boolean;
  isOverdue: boolean;
  isDueSoon: boolean;
  statusText: string;
}

export function evaluateReminder(
  reminder: FinancialReminder,
  refDateISO = todayISO(),
  refTimeHHMM = currentTimeHHMM()
): EvaluatedReminder {
  const daysRemaining = daysUntilDue(reminder.due_date, refDateISO);
  const allOffsets = normalizeReminderOffsets(
    reminder.remind_offsets ?? [],
    reminder.custom_days_before
  );
  const reminderTime = /^\d{2}:\d{2}$/.test(reminder.reminder_time || "")
    ? reminder.reminder_time
    : "08:00";

  let status: ReminderStatusKind = "upcoming";
  if (!reminder.is_active) {
    status = "inactive";
  } else if (daysRemaining !== null && daysRemaining < 0) {
    status = "overdue";
  } else if (daysRemaining === 0) {
    status = "due_today";
  } else if (daysRemaining !== null && daysRemaining <= 7) {
    status = "due_soon";
  }

  let matchedOffset: number | null = null;
  if (reminder.is_active && daysRemaining !== null) {
    if (daysRemaining >= 0 && allOffsets.includes(daysRemaining) && refTimeHHMM >= reminderTime) {
      matchedOffset = daysRemaining;
    } else if (daysRemaining < 0 && (allOffsets.includes(0) || allOffsets.length > 0)) {
      matchedOffset = -1;
    }
  }

  const notificationKey =
    matchedOffset !== null
      ? buildReminderNotificationKey(reminder.id, reminder.due_date, matchedOffset)
      : null;

  const shouldNotifyNow =
    Boolean(reminder.is_active) &&
    notificationKey !== null &&
    reminder.last_notified_key !== notificationKey;

  let statusText = reminder.due_date;
  if (!reminder.is_active) {
    statusText = "Nonaktif";
  } else if (daysRemaining === null) {
    statusText = reminder.due_date;
  } else if (daysRemaining < 0) {
    statusText = `Terlambat ${Math.abs(daysRemaining)} hari`;
  } else if (daysRemaining === 0) {
    statusText = "Jatuh tempo hari ini";
  } else if (daysRemaining === 1) {
    statusText = "Besok (H-1)";
  } else {
    statusText = `${daysRemaining} hari lagi (H-${daysRemaining})`;
  }

  const isDueToday = reminder.is_active && daysRemaining === 0;
  const isOverdue = reminder.is_active && daysRemaining !== null && daysRemaining < 0;
  const isDueSoon =
    reminder.is_active && daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7;
  const isTodayWindow =
    reminder.is_active &&
    (isDueToday || (matchedOffset !== null && matchedOffset >= 0));

  return {
    reminder,
    daysRemaining,
    status,
    allOffsets,
    matchedOffset,
    notificationKey,
    shouldNotifyNow,
    isDueToday,
    isTodayWindow,
    isOverdue,
    isDueSoon,
    statusText,
  };
}

export type ReminderStatusFilter =
  | "all"
  | "unread"
  | "overdue"
  | "due_today"
  | "due_soon"
  | "upcoming"
  | "inactive"
  | "payment"
  | "savings";

export interface ReminderFilterOptions {
  category?: ReminderCategory | "all";
  status?: ReminderStatusFilter;
  search?: string;
}

export function filterEvaluatedReminders(
  items: EvaluatedReminder[],
  options: ReminderFilterOptions = {}
): EvaluatedReminder[] {
  const q = (options.search ?? "").trim().toLowerCase();
  return items
    .filter((item) => {
      const r = item.reminder;
      if (options.category && options.category !== "all" && r.reminder_type !== options.category) {
        return false;
      }
      if (options.status && options.status !== "all") {
        switch (options.status) {
          case "unread":
            if (!r.is_active || r.is_read) return false;
            break;
          case "overdue":
            if (!item.isOverdue) return false;
            break;
          case "due_today":
            if (!item.isTodayWindow) return false;
            break;
          case "due_soon":
            if (item.status !== "due_soon" && item.status !== "due_today") return false;
            break;
          case "upcoming":
            if (!r.is_active || (item.daysRemaining !== null && item.daysRemaining < 0)) return false;
            break;
          case "inactive":
            if (r.is_active) return false;
            break;
          case "payment":
            if (reminderCategoryMeta(r.reminder_type).group !== "payment") return false;
            break;
          case "savings":
            if (reminderCategoryMeta(r.reminder_type).group !== "savings") return false;
            break;
        }
      }
      if (q) {
        const title = r.title.toLowerCase();
        const notes = (r.notes ?? "").toLowerCase();
        const cat = reminderCategoryMeta(r.reminder_type).label.toLowerCase();
        if (!title.includes(q) && !notes.includes(q) && !cat.includes(q)) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (a.reminder.is_active !== b.reminder.is_active) {
        return a.reminder.is_active ? -1 : 1;
      }
      return a.reminder.due_date.localeCompare(b.reminder.due_date);
    });
}

export interface ReminderDashboardItem {
  id: string;
  source: "reminder" | "bill" | "debt";
  title: string;
  dueDate: string;
  daysRemaining: number | null;
  amount: number;
  categoryLabel: string;
  isSavings: boolean;
  isOverdue: boolean;
  isUnread: boolean;
}

export interface ReminderDashboardSummary {
  totalActiveCount: number;
  unreadCount: number;
  overdueCount: number;
  dueTodayCount: number;
  upcomingBillsCount: number;
  nearestReminder: ReminderDashboardItem | null;
  nextSavingsDeposit: ReminderDashboardItem | null;
}

export function summarizeRemindersForDashboard(
  reminders: FinancialReminder[],
  bills: RecurringBill[],
  debts: Debt[],
  refDateISO = todayISO()
): ReminderDashboardSummary {
  const items: ReminderDashboardItem[] = [];
  const linkedBillIds = new Set<string>();
  const linkedDebtIds = new Set<string>();

  for (const r of reminders) {
    if (r.linked_bill_id) linkedBillIds.add(r.linked_bill_id);
    if (r.linked_debt_id) linkedDebtIds.add(r.linked_debt_id);
    if (!r.is_active) continue;
    const days = daysUntilDue(r.due_date, refDateISO);
    const meta = reminderCategoryMeta(r.reminder_type);
    items.push({
      id: r.id,
      source: "reminder",
      title: r.title,
      dueDate: r.due_date,
      daysRemaining: days,
      amount: r.amount,
      categoryLabel: meta.shortLabel,
      isSavings: meta.group === "savings",
      isOverdue: days !== null && days < 0,
      isUnread: !r.is_read,
    });
  }

  for (const bill of bills) {
    if (!bill.is_active || linkedBillIds.has(bill.id)) continue;
    const days = daysUntilDue(bill.next_due_date, refDateISO);
    items.push({
      id: `bill:${bill.id}`,
      source: "bill",
      title: bill.title,
      dueDate: bill.next_due_date,
      daysRemaining: days,
      amount: bill.amount,
      categoryLabel: bill.transaction_type === "income" ? "Pemasukan" : "Tagihan",
      isSavings: false,
      isOverdue: days !== null && days < 0,
      isUnread: days !== null && days <= 7,
    });
  }

  for (const debt of debts) {
    if (
      debt.status !== "active" ||
      debt.outstanding_balance <= 0 ||
      !debt.due_date ||
      linkedDebtIds.has(debt.id)
    ) {
      continue;
    }
    const days = daysUntilDue(debt.due_date, refDateISO);
    items.push({
      id: `debt:${debt.id}`,
      source: "debt",
      title: `Cicilan ${debt.creditor}`,
      dueDate: debt.due_date,
      daysRemaining: days,
      amount: debt.outstanding_balance,
      categoryLabel: "Utang",
      isSavings: false,
      isOverdue: days !== null && days < 0,
      isUnread: days !== null && days <= 7,
    });
  }

  const sorted = [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const overdueCount = sorted.filter((i) => i.isOverdue).length;
  const dueTodayCount = sorted.filter((i) => i.daysRemaining === 0).length;
  const unreadCount = sorted.filter((i) => i.isUnread).length;
  const upcomingBillsCount = sorted.filter(
    (i) => !i.isSavings && i.daysRemaining !== null && i.daysRemaining >= 0 && i.daysRemaining <= 30
  ).length;

  const nearestReminder =
    sorted.find((i) => i.isOverdue) ??
    sorted.find((i) => i.daysRemaining !== null && i.daysRemaining >= 0) ??
    sorted[0] ??
    null;

  const nextSavingsDeposit =
    sorted.find((i) => i.isSavings && i.daysRemaining !== null && i.daysRemaining >= 0) ??
    sorted.find((i) => i.isSavings) ??
    null;

  return {
    totalActiveCount: sorted.length,
    unreadCount,
    overdueCount,
    dueTodayCount,
    upcomingBillsCount,
    nearestReminder,
    nextSavingsDeposit,
  };
}

export function buildSourceSyncReminders(
  bills: RecurringBill[],
  debts: Debt[],
  existingReminders: FinancialReminder[],
  ownerId: string
): Array<Omit<FinancialReminder, "id" | "created_at" | "updated_at">> {
  const existingKeys = new Set<string>();
  for (const r of existingReminders) {
    if (r.dedupe_key) existingKeys.add(r.dedupe_key);
    if (r.linked_bill_id) existingKeys.add(buildReminderDedupeKey("bill", r.linked_bill_id));
    if (r.linked_debt_id) existingKeys.add(buildReminderDedupeKey("debt", r.linked_debt_id));
  }

  const payloads: Array<Omit<FinancialReminder, "id" | "created_at" | "updated_at">> = [];

  for (const bill of bills) {
    if (!bill.is_active) continue;
    const dedupeKey = buildReminderDedupeKey("bill", bill.id);
    if (existingKeys.has(dedupeKey)) continue;
    existingKeys.add(dedupeKey);
    payloads.push({
      owner_id: ownerId,
      title: bill.title,
      reminder_type:
        bill.transaction_type === "income" ? "pemasukan_rutin" : "tagihan_bulanan",
      transaction_type: bill.transaction_type,
      amount: bill.amount,
      due_date: bill.next_due_date.slice(0, 10),
      reminder_time: "08:00",
      frequency: bill.frequency,
      remind_offsets: [7, 3, 1, 0],
      custom_days_before: null,
      is_active: true,
      is_read: false,
      read_at: null,
      last_notified_key: null,
      last_notified_at: null,
      linked_account_id: bill.account_id,
      linked_goal_id: null,
      linked_debt_id: null,
      linked_bill_id: bill.id,
      dedupe_key: dedupeKey,
      notes: bill.notes,
    });
  }

  for (const debt of debts) {
    if (debt.status !== "active" || debt.outstanding_balance <= 0 || !debt.due_date) {
      continue;
    }
    const dedupeKey = buildReminderDedupeKey("debt", debt.id);
    if (existingKeys.has(dedupeKey)) continue;
    existingKeys.add(dedupeKey);
    payloads.push({
      owner_id: ownerId,
      title: `Cicilan ${debt.creditor}`,
      reminder_type: "cicilan_utang",
      transaction_type: "expense",
      amount: debt.outstanding_balance,
      due_date: debt.due_date.slice(0, 10),
      reminder_time: "08:00",
      frequency: "monthly",
      remind_offsets: [7, 3, 1, 0],
      custom_days_before: null,
      is_active: true,
      is_read: false,
      read_at: null,
      last_notified_key: null,
      last_notified_at: null,
      linked_account_id: null,
      linked_goal_id: null,
      linked_debt_id: debt.id,
      linked_bill_id: null,
      dedupe_key: dedupeKey,
      notes: debt.description,
    });
  }

  return payloads;
}

export function generateReminderIcs(
  reminder: FinancialReminder,
  dateFormat: DateFormatPref = "DD MMM YYYY"
): string {
  const cleanDate = reminder.due_date.slice(0, 10).replace(/-/g, "");
  const cleanTime = (/^\d{2}:\d{2}$/.test(reminder.reminder_time)
    ? reminder.reminder_time
    : "08:00"
  ).replace(":", "");
  const dtStart = `${cleanDate}T${cleanTime}00`;
  const uid = `${reminder.id}@ego-personal-ai.local`;
  const meta = reminderCategoryMeta(reminder.reminder_type);
  const summary = `[EGO] ${reminder.title} (${formatIDR(reminder.amount)})`.replace(
    /[\r\n]/g,
    " "
  );
  const description = [
    `Kategori: ${meta.label}`,
    `Nominal: ${formatIDR(reminder.amount)}`,
    `Jatuh Tempo: ${formatDateID(reminder.due_date, dateFormat)}`,
    reminder.notes ? `Catatan: ${reminder.notes}` : "",
    "EGO tidak mendebit saldo otomatis. Konfirmasi transaksi dilakukan oleh Owner.",
  ]
    .filter(Boolean)
    .join("\\n")
    .replace(/\r?\n/g, "\\n");

  const rrule =
    reminder.frequency === "weekly"
      ? "RRULE:FREQ=WEEKLY"
      : reminder.frequency === "monthly"
        ? "RRULE:FREQ=MONTHLY"
        : reminder.frequency === "yearly"
          ? "RRULE:FREQ=YEARLY"
          : null;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EGO Personal AI//Financial Reminder//ID",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${cleanDate}T000000Z`,
    `DTSTART:${dtStart}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    ...(rrule ? [rrule] : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${summary}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

export interface PwaNotificationCapabilities {
  isBrowser: boolean;
  notificationSupported: boolean;
  permission: NotificationPermission | "unsupported";
  serviceWorkerSupported: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  pushBackendConfigured: boolean;
  canInAppNotify: boolean;
  canBrowserNotify: boolean;
  statusSummary: string;
  iosExplanation: string;
}

export function detectPwaNotificationCapabilities(): PwaNotificationCapabilities {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      isBrowser: false,
      notificationSupported: false,
      permission: "unsupported",
      serviceWorkerSupported: false,
      isStandalone: false,
      isIOS: false,
      pushBackendConfigured: false,
      canInAppNotify: true,
      canBrowserNotify: false,
      statusSummary: "Notifikasi dalam aplikasi aktif saat brankas dibuka.",
      iosExplanation:
        "Pada iPhone/iPad (iOS 16.4+), notifikasi browser hanya tersedia setelah aplikasi dipasang ke Layar Utama.",
    };
  }

  const ua = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  const notificationSupported = typeof Notification !== "undefined";
  const permission: NotificationPermission | "unsupported" = notificationSupported
    ? Notification.permission
    : "unsupported";
  const serviceWorkerSupported = "serviceWorker" in navigator;
  const pushBackendConfigured = false;
  const canBrowserNotify = notificationSupported && permission === "granted";

  let statusSummary =
    "Notifikasi dalam aplikasi aktif otomatis setiap menit saat EGO dibuka.";
  if (isIOS && !isStandalone) {
    statusSummary =
      "Browser iOS Safari belum mendukung notifikasi sistem sebelum dipasang ke Layar Utama (Add to Home Screen).";
  } else if (canBrowserNotify) {
    statusSummary =
      "Notifikasi dalam aplikasi dan notifikasi browser aktif saat aplikasi berjalan.";
  } else if (notificationSupported && permission === "denied") {
    statusSummary =
      "Izin notifikasi browser diblokir. Aktifkan ulang melalui pengaturan situs browser, atau gunakan notifikasi dalam aplikasi & ekspor kalender .ics.";
  }

  const iosExplanation =
    "Keterbatasan iOS & Push Latar Belakang: EGO tidak memakai server push berbayar/VAPID. Saat aplikasi tertutup penuh, notifikasi latar belakang tidak dikirim otomatis. Di iPhone/iPad (iOS 16.4+), pasang EGO ke Layar Utama lalu gunakan tombol Ekspor Kalender (.ics) untuk alarm perangkat yang bekerja 100% offline.";

  return {
    isBrowser: true,
    notificationSupported,
    permission,
    serviceWorkerSupported,
    isStandalone,
    isIOS,
    pushBackendConfigured,
    canInAppNotify: true,
    canBrowserNotify,
    statusSummary,
    iosExplanation,
  };
}
