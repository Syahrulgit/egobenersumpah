import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { EGO_EASE, triggerSignatureFeedback } from "./ego-motion";

interface ModalSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidthClass?: string;
}

export function ModalSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClass = "max-w-lg",
}: ModalSheetProps) {
  const [isMobileSheet, setIsMobileSheet] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 639px)").matches
      : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 639px)");
    const onChange = () => setIsMobileSheet(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const panelInitial = isMobileSheet
    ? { opacity: 0, y: 48, scale: 1 }
    : { opacity: 0, y: 10, scale: 0.95 };
  const panelExit = isMobileSheet
    ? { opacity: 0, y: 40, scale: 1 }
    : { opacity: 0, y: 8, scale: 0.96 };
  const panelTransition = isMobileSheet
    ? { type: "spring" as const, stiffness: 360, damping: 32, mass: 0.85 }
    : { duration: 0.22, ease: EGO_EASE };

  const content = (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="modal-sheet-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: EGO_EASE }}
          className="fixed inset-0 z-[90] flex items-end justify-center bg-[#0B111E]/70 backdrop-blur-xs sm:items-center sm:p-4 dark:bg-black/80"
          onClick={onClose}
        >
          <motion.div
            key="modal-sheet-panel"
            initial={panelInitial}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={panelExit}
            transition={panelTransition}
            className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl dark:border-[#D4AF37]/25 dark:bg-[#101827] ${maxWidthClass}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600 sm:hidden" />

            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-[#1E293B]">
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-[#101827] dark:text-white">
                  {title}
                </h2>
                {subtitle ? (
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    {subtitle}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  triggerSignatureFeedback(e.currentTarget, "action", e);
                  onClose();
                }}
                aria-label={`Tutup ${title}`}
                className="ego-pressable ego-icon-action flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#101827] dark:text-slate-400 dark:hover:bg-[#162032] dark:hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="pb-safe flex-1 overflow-y-auto px-5 py-5 pb-8 sm:pb-6">
              {children}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (typeof document === "undefined") {
    return content;
  }

  return createPortal(content, document.body);
}
