import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { formatIDR } from "../../lib/finance";
import { useAuthStatus, useRecordReminderTriggered, useVaultSnapshot } from "../../lib/queries";
import { evaluateReminder, reminderCategoryMeta } from "../../lib/reminders";

export function ReminderNotificationBridge() {
  const { data: auth } = useAuthStatus();
  const { data: vault } = useVaultSnapshot(Boolean(auth?.authenticated));
  const recordTrigger = useRecordReminderTriggered();
  const navigate = useNavigate();

  const sessionNotifiedKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!auth?.authenticated || !vault || vault.remindersTableReady === false) {
      return;
    }

    const reminders = vault.financial_reminders ?? [];
    if (reminders.length === 0) return;

    const runCheck = () => {
      for (const r of reminders) {
        const evaluated = evaluateReminder(r);
        if (!evaluated.shouldNotifyNow || !evaluated.notificationKey) continue;
        if (sessionNotifiedKeys.current.has(evaluated.notificationKey)) continue;

        sessionNotifiedKeys.current.add(evaluated.notificationKey);

        const meta = reminderCategoryMeta(r.reminder_type);
        const heading = evaluated.isOverdue
          ? `Terlambat: ${r.title}`
          : evaluated.isDueToday
            ? `Hari Ini: ${r.title}`
            : `Pengingat H-${evaluated.matchedOffset}: ${r.title}`;
        const detail = `${meta.label} · ${formatIDR(r.amount)} (${evaluated.statusText})`;

        if (evaluated.isOverdue || evaluated.isDueToday) {
          toast.warning(heading, {
            description: detail,
            action: {
              label: "Buka Pengingat",
              onClick: () => {
                void navigate({ to: "/pengingat" });
              },
            },
          });
        } else {
          toast.info(heading, {
            description: detail,
            action: {
              label: "Lihat",
              onClick: () => {
                void navigate({ to: "/pengingat" });
              },
            },
          });
        }

        if (
          typeof window !== "undefined" &&
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          const notifOptions: NotificationOptions = {
            body: `${detail}. Konfirmasi manual di EGO.`,
            icon: "/icon-192.png",
            tag: evaluated.notificationKey,
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

        recordTrigger.mutate({
          reminder: r,
          notification_key: evaluated.notificationKey,
          trigger_offset: evaluated.matchedOffset,
        });
      }
    };

    runCheck();
    const intervalId = window.setInterval(runCheck, 60_000);
    return () => window.clearInterval(intervalId);
  }, [auth?.authenticated, vault, navigate, recordTrigger]);

  return null;
}
