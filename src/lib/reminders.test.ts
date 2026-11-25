import assert from "node:assert/strict";
import test from "node:test";
import type { Debt, FinancialReminder, RecurringBill } from "../types/ego";
import {
  advanceReminderDueDate,
  buildReminderDedupeKey,
  buildReminderNotificationKey,
  buildSourceSyncReminders,
  evaluateReminder,
  filterEvaluatedReminders,
  generateReminderIcs,
  summarizeRemindersForDashboard,
} from "./reminders.ts";

function makeReminder(overrides: Partial<FinancialReminder> = {}): FinancialReminder {
  return {
    id: "rem-1",
    owner_id: "owner-1",
    title: "Listrik PLN",
    reminder_type: "tagihan_bulanan",
    transaction_type: "expense",
    amount: 450000,
    due_date: "2026-12-10",
    reminder_time: "08:00",
    frequency: "monthly",
    remind_offsets: [7, 3, 1, 0],
    custom_days_before: null,
    is_active: true,
    is_read: false,
    read_at: null,
    last_notified_key: null,
    last_notified_at: null,
    linked_account_id: "acc-1",
    linked_goal_id: null,
    linked_debt_id: null,
    linked_bill_id: null,
    dedupe_key: null,
    notes: null,
    created_at: "2026-11-25T00:00:00Z",
    updated_at: "2026-11-25T00:00:00Z",
    ...overrides,
  };
}

test("evaluateReminder detects H-7, H-3, H-1, H-0, custom offset, and overdue states accurately", () => {
  const base = makeReminder({
    due_date: "2026-12-10",
    reminder_time: "08:00",
    remind_offsets: [7, 3, 1, 0],
    custom_days_before: 5,
  });

  // H-7 before 08:00 -> should not trigger browser/app alert yet
  const h7Early = evaluateReminder(base, "2026-12-03", "07:30");
  assert.equal(h7Early.daysRemaining, 7);
  assert.equal(h7Early.status, "due_soon");
  assert.equal(h7Early.matchedOffset, null);
  assert.equal(h7Early.shouldNotifyNow, false);

  // H-7 after 08:00 -> triggers H-7 alert
  const h7Active = evaluateReminder(base, "2026-12-03", "08:05");
  assert.equal(h7Active.matchedOffset, 7);
  assert.equal(h7Active.shouldNotifyNow, true);
  assert.equal(h7Active.notificationKey, buildReminderNotificationKey("rem-1", "2026-12-10", 7));

  // Duplicate prevention when last_notified_key matches
  const alreadySent = evaluateReminder(
    makeReminder({
      ...base,
      last_notified_key: h7Active.notificationKey,
    }),
    "2026-12-03",
    "09:00"
  );
  assert.equal(alreadySent.shouldNotifyNow, false);

  // Custom H-5 offset
  const h5Custom = evaluateReminder(base, "2026-12-05", "08:00");
  assert.equal(h5Custom.matchedOffset, 5);
  assert.equal(h5Custom.shouldNotifyNow, true);

  // H-0 due today
  const h0 = evaluateReminder(base, "2026-12-10", "08:00");
  assert.equal(h0.status, "due_today");
  assert.equal(h0.isDueToday, true);
  assert.equal(h0.matchedOffset, 0);

  // Overdue (H+2)
  const overdue = evaluateReminder(base, "2026-12-12", "09:00");
  assert.equal(overdue.status, "overdue");
  assert.equal(overdue.isOverdue, true);
  assert.equal(overdue.statusText, "Terlambat 2 hari");

  // Inactive
  const paused = evaluateReminder(makeReminder({ is_active: false }), "2026-12-12", "09:00");
  assert.equal(paused.status, "inactive");
  assert.equal(paused.shouldNotifyNow, false);
});

test("filterEvaluatedReminders filters by category, status, and search query", () => {
  const items = [
    evaluateReminder(makeReminder({ id: "1", title: "Internet Rumah", due_date: "2026-12-01" }), "2026-12-03", "09:00"),
    evaluateReminder(makeReminder({ id: "2", title: "Setoran Dana Darurat", reminder_type: "setoran_tabungan", transaction_type: "transfer", due_date: "2026-12-05", is_read: true }), "2026-12-03", "09:00"),
    evaluateReminder(makeReminder({ id: "3", title: "Gaji Bulanan", reminder_type: "tanggal_gajian", transaction_type: "income", due_date: "2026-12-25", is_active: false }), "2026-12-03", "09:00"),
  ];

  assert.equal(filterEvaluatedReminders(items, { status: "overdue" }).length, 1);
  assert.equal(filterEvaluatedReminders(items, { status: "savings" }).length, 1);
  assert.equal(filterEvaluatedReminders(items, { status: "unread" }).length, 1);
  assert.equal(filterEvaluatedReminders(items, { status: "inactive" }).length, 1);
  assert.equal(filterEvaluatedReminders(items, { category: "setoran_tabungan" }).length, 1);
  assert.equal(filterEvaluatedReminders(items, { search: "darurat" }).length, 1);
});

test("buildSourceSyncReminders prevents duplicates and summarizeRemindersForDashboard merges sources cleanly", () => {
  const bills: RecurringBill[] = [
    {
      id: "bill-1",
      owner_id: "owner-1",
      title: "IndiHome",
      transaction_type: "expense",
      amount: 350000,
      category: "Utilitas",
      account_id: "acc-1",
      frequency: "monthly",
      next_due_date: "2026-12-05",
      is_active: true,
      notes: null,
      last_queued_date: null,
      created_at: "2026-11-01T00:00:00Z",
    },
    {
      id: "bill-2",
      owner_id: "owner-1",
      title: "Sudah Tersinkron",
      transaction_type: "expense",
      amount: 200000,
      category: "Utilitas",
      account_id: null,
      frequency: "monthly",
      next_due_date: "2026-12-06",
      is_active: true,
      notes: null,
      last_queued_date: null,
      created_at: "2026-11-01T00:00:00Z",
    },
  ];
  const debts: Debt[] = [
    {
      id: "debt-1",
      owner_id: "owner-1",
      creditor: "KPR Bank",
      original_amount: 100000000,
      outstanding_balance: 50000000,
      due_date: "2026-12-01",
      status: "active",
      description: null,
      created_at: "2026-11-01T00:00:00Z",
    },
  ];

  const existing: FinancialReminder[] = [
    makeReminder({
      id: "rem-linked",
      title: "Sudah Tersinkron",
      due_date: "2026-12-06",
      linked_bill_id: "bill-2",
      dedupe_key: buildReminderDedupeKey("bill", "bill-2"),
    }),
    makeReminder({
      id: "rem-save",
      title: "Setoran Target Laptop",
      reminder_type: "setoran_tabungan",
      transaction_type: "transfer",
      due_date: "2026-12-08",
    }),
  ];

  const syncPayloads = buildSourceSyncReminders(bills, debts, existing, "owner-1");
  assert.equal(syncPayloads.length, 2);
  assert.equal(syncPayloads[0].linked_bill_id, "bill-1");
  assert.equal(syncPayloads[1].linked_debt_id, "debt-1");

  const dash = summarizeRemindersForDashboard(existing, bills, debts, "2026-12-03");
  assert.equal(dash.overdueCount, 1); // debt-1 due 2026-12-01
  assert.equal(dash.nearestReminder?.title, "Cicilan KPR Bank");
  assert.equal(dash.nextSavingsDeposit?.title, "Setoran Target Laptop");
  assert.equal(dash.totalActiveCount, 4); // 2 existing + bill-1 + debt-1 (bill-2 deduped)
});

test("advanceReminderDueDate and generateReminderIcs handle dates and calendar formatting", () => {
  assert.equal(advanceReminderDueDate("2026-12-10", "once"), "2026-12-10");
  assert.equal(advanceReminderDueDate("2026-01-31", "monthly"), "2026-02-28");
  assert.equal(advanceReminderDueDate("2026-12-10", "weekly"), "2026-12-17");

  const ics = generateReminderIcs(makeReminder());
  assert.ok(ics.includes("BEGIN:VCALENDAR"));
  assert.ok(ics.includes("DTSTART:20261210T080000"));
  assert.ok(ics.includes("RRULE:FREQ=MONTHLY"));
  assert.ok(ics.includes("BEGIN:VALARM"));
});
