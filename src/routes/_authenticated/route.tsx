import { Outlet, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { AppShellFrame } from "../../components/ego/app-shell";
import { BudgetAlertBridge } from "../../components/ego/budget-alert-bridge";
import { PinLockScreen } from "../../components/ego/pin-lock-screen";
import { ReminderNotificationBridge } from "../../components/ego/reminder-notification-bridge";
import { TransactionSheetProvider } from "../../components/ego/transaction-input-sheet";
import {
  isPasswordRecoveryActive,
  subscribePasswordRecoveryChange,
} from "../../lib/auth-recovery";
import {
  shouldShowPinLockScreen,
  subscribePinLockChange,
} from "../../lib/pin-lock";
import { useAuthStatus } from "../../lib/queries";

export function AuthenticatedLayout() {
  const navigate = useNavigate();
  const { data: auth, isLoading } = useAuthStatus();
  const recoveryActive = useSyncExternalStore(
    subscribePasswordRecoveryChange,
    isPasswordRecoveryActive,
    () => false
  );
  const isPinLockedView = useSyncExternalStore(
    subscribePinLockChange,
    () => shouldShowPinLockScreen(Boolean(auth?.hasPin)),
    () => false
  );

  useEffect(() => {
    if (recoveryActive) {
      void navigate({ to: "/auth" });
      return;
    }
    if (!isLoading && auth && !auth.authenticated) {
      void navigate({ to: "/auth" });
    }
  }, [auth, isLoading, navigate, recoveryActive]);

  if (recoveryActive || isLoading || !auth?.authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F7FB] text-sm text-slate-600 dark:bg-[#0B111E] dark:text-slate-300">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#D4AF37]" />
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
      <AppShellFrame>
        <Outlet />
      </AppShellFrame>
    </TransactionSheetProvider>
  );
}
