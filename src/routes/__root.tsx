import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { setPasswordRecoveryActive } from "../lib/auth-recovery";
import { egoKeys } from "../lib/queries";
import { supabase, subscribeSupabaseChange } from "../lib/supabase";
import { MotionConfig } from "motion/react";
import { ThemeProvider, useTheme } from "../lib/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RootContent() {
  const { theme } = useTheme();
  const qc = useQueryClient();

  useEffect(() => {
    let authUnsubscribe: (() => void) | null = null;

    const bindAuthListener = () => {
      if (authUnsubscribe) {
        authUnsubscribe();
        authUnsubscribe = null;
      }
      if (!supabase) return;
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          setPasswordRecoveryActive(true);
        } else if (event === "SIGNED_OUT") {
          setPasswordRecoveryActive(false);
        }
        void qc.invalidateQueries({ queryKey: egoKeys.auth });
        void qc.invalidateQueries({ queryKey: egoKeys.vault });
      });
      authUnsubscribe = () => subscription.unsubscribe();
    };

    bindAuthListener();
    const unsubSupabase = subscribeSupabaseChange(() => {
      bindAuthListener();
      void qc.invalidateQueries({ queryKey: egoKeys.auth });
    });

    return () => {
      unsubSupabase();
      if (authUnsubscribe) {
        authUnsubscribe();
      }
    };
  }, [qc]);

  return (
    <>
      <Outlet />
      <Toaster
        position="bottom-right"
        duration={3200}
        theme={theme}
        toastOptions={{
          classNames: {
            toast:
              "mb-16 md:mb-0 rounded-2xl border border-slate-200 bg-white text-[#101827] shadow-xl dark:border-[#D4AF37]/30 dark:bg-[#101827] dark:text-white",
          },
        }}
      />
    </>
  );
}

export function RootComponent() {
  return (
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <RootContent />
        </QueryClientProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
