import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { egoKeys } from "../lib/queries";
import { supabase } from "../lib/supabase";
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
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void qc.invalidateQueries({ queryKey: egoKeys.auth });
      void qc.invalidateQueries({ queryKey: egoKeys.vault });
    });
    return () => {
      subscription.unsubscribe();
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
