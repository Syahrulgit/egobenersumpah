import { Outlet, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { BudgetAlertBridge } from "../../components/ego/budget-alert-bridge";
import { PinLockScreen } from "../../components/ego/pin-lock-screen";
import { ReminderNotificationBridge } from "../../components/ego/reminder-notification-bridge";
import { TransactionSheetProvider } from "../../components/ego/transaction-input-sheet";
import {
  shouldShowPinLockScreen,
  subscribePinLockChange,
} from "../../lib/pin-lock";
import { useAuthStatus } from "../../lib/queries";

export function AuthenticatedLayout() {
  const navigate = useNavigate();
  const { data: auth, isLoading } = useAuthStatus();
  const isPinLockedView = useSyncExternalStore(
    subscribePinLockChange,
    () => shouldShowPinLockScreen(Boolean(auth?.hasPin)),
    () => false
  );

  useEffect(() => {
    if (!isLoading && auth && !auth.authenticated) {
      void navigate({ to: "/auth" });
    }
  }, [auth, isLoading, navigate]);

  if (isLoading || !auth?.authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F7FB] text-sm text-slate-600 dark:bg-[#040B1C] dark:text-[#C7D0E0]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#087BFF] dark:text-[#19D8FF]" />
        <span>Memverifikasi sesi brankas Anda...</span>
      </div>
    );
  }

  if (isPinLockedView) {
    return (
      <PinLockScreen
        ownerName={auth.owner?.full_name || auth.owner?.email || "Owner Utama"}
      />
    );
  }

  return (
    <TransactionSheetProvider>
      <ReminderNotificationBridge />
      <BudgetAlertBridge />
      <Outlet />
    </TransactionSheetProvider>
  );
}
