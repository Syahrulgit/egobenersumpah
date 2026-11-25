import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";

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

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#06132F]/60 backdrop-blur-xs sm:items-center sm:p-4 dark:bg-black/75"
      onClick={onClose}
    >
      <div
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-[#DCE4F0] bg-white shadow-2xl sm:rounded-3xl dark:border-[#1B3163] dark:bg-[#091634] ${maxWidthClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-slate-300 dark:bg-[#233E7A] sm:hidden" />

        <div className="flex items-start justify-between gap-3 border-b border-[#DCE4F0] px-5 py-4 dark:border-[#1B3163]">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-[#06132F] dark:text-white">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-slate-600 dark:text-[#C7D0E0]/75">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Tutup ${title}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#06132F] dark:text-[#C7D0E0] dark:hover:bg-[#0D1E45] dark:hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 pb-8 sm:pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}
