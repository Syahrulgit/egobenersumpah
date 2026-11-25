import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { budgetThresholdLabel, evaluateBudgetsForMonth } from "../../lib/budgets";
import { formatIDR, todayISO } from "../../lib/finance";
import {
  useAuthStatus,
  useRecordBudgetAlert,
  useVaultSnapshot,
} from "../../lib/queries";

export function BudgetAlertBridge() {
  const { data: auth } = useAuthStatus();
  const { data: vault } = useVaultSnapshot(Boolean(auth?.authenticated));
  const recordAlert = useRecordBudgetAlert();
  const navigate = useNavigate();

  const sessionNotifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!auth?.authenticated || !vault || vault.budgetsTableReady === false) {
      return;
    }
    const budgets = vault.category_budgets ?? [];
    if (budgets.length === 0) return;

    const currentMonth = todayISO().slice(0, 7);
    const evaluated = evaluateBudgetsForMonth(
      budgets,
      vault.transactions ?? [],
      currentMonth,
      vault.budget_alert_logs ?? [],
      vault.recurring_bills ?? [],
      vault.financial_reminders ?? []
    );

    for (const item of evaluated) {
      const threshold = item.pendingAlertThreshold;
      if (threshold === null) continue;

      const sessionKey = `${item.budget.id}:${currentMonth}:${threshold}`;
      if (sessionNotifiedRef.current.has(sessionKey)) continue;
      sessionNotifiedRef.current.add(sessionKey);

      const heading =
        threshold === 101
          ? `Anggaran Terlampaui: ${item.budget.category}`
          : threshold === 100
            ? `Anggaran Tercapai 100%: ${item.budget.category}`
            : threshold === 90
              ? `Peringatan Tinggi 90%: ${item.budget.category}`
              : threshold === 75
                ? `Mendekati Batas 75%: ${item.budget.category}`
                : `Info Anggaran 50%: ${item.budget.category}`;

      const detail = `${budgetThresholdLabel(threshold)} · Terpakai ${formatIDR(
        item.spentAmount
      )} dari ${formatIDR(item.budget.limit_amount)} (${item.usagePct.toFixed(1)}%)`;

      const navAction = {
        label: "Buka Anggaran",
        onClick: () => {
          void navigate({ to: "/anggaran" });
        },
      };

      if (threshold >= 100) {
        toast.error(heading, { description: detail, action: navAction });
      } else if (threshold >= 75) {
        toast.warning(heading, { description: detail, action: navAction });
      } else {
        toast.info(heading, { description: detail, action: navAction });
      }

      if (
        typeof window !== "undefined" &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        const notifOptions: NotificationOptions = {
          body: detail,
          icon: "/icon-192.png",
          tag: `ego-budget-${sessionKey}`,
        };
        if ("serviceWorker" in navigator) {
          void navigator.serviceWorker.ready
            .then((reg) => reg.showNotification(heading, notifOptions))
            .catch(() => {
              try {
                new Notification(heading, notifOptions);
              } catch {
                // Ignore browser restriction
              }
            });
        } else {
          try {
            new Notification(heading, notifOptions);
          } catch {
            // Ignore browser restriction
          }
        }
      }

      recordAlert.mutate({
        budget: item.budget,
        period_month: currentMonth,
        threshold_level: threshold,
        spent_amount: item.spentAmount,
        usage_pct: item.usagePct,
        existingLogs: vault.budget_alert_logs ?? [],
      });
    }
  }, [auth?.authenticated, vault, navigate, recordAlert]);

  return null;
}
