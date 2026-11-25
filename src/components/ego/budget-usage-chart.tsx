import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useMemo, useState } from "react";
import type { EvaluatedBudget } from "../../lib/budgets";
import { formatIDR } from "../../lib/finance";
import type { BudgetSeverityLevel } from "../../types/ego";

interface BudgetUsageChartProps {
  items: EvaluatedBudget[];
  compact?: boolean;
  balanceHidden?: boolean;
  onSelectCategory?: (category: string) => void;
}

function severityBarColor(severity: BudgetSeverityLevel): string {
  switch (severity) {
    case "exceeded_over":
    case "reached_100":
      return "bg-gradient-to-r from-rose-500 to-rose-600";
    case "high_90":
      return "bg-gradient-to-r from-orange-500 to-rose-500";
    case "warning_75":
      return "bg-gradient-to-r from-amber-400 to-amber-500";
    case "info_50":
      return "bg-gradient-to-r from-[#087BFF] to-[#19D8FF]";
    case "inactive":
      return "bg-slate-300 dark:bg-slate-600";
    default:
      return "bg-gradient-to-r from-[#087BFF] to-cyan-400";
  }
}

export function severityBadgeClass(severity: BudgetSeverityLevel): string {
  switch (severity) {
    case "exceeded_over":
      return "bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300";
    case "reached_100":
      return "bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300";
    case "high_90":
      return "bg-orange-500/15 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300";
    case "warning_75":
      return "bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300";
    case "info_50":
      return "bg-[#087BFF]/12 text-[#087BFF] dark:bg-[#19D8FF]/18 dark:text-[#19D8FF]";
    case "inactive":
      return "bg-slate-200/80 text-slate-600 dark:bg-[#0D1E45] dark:text-[#C7D0E0]/70";
    default:
      return "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300";
  }
}

export function BudgetUsageChart({
  items,
  compact = false,
  balanceHidden = false,
  onSelectCategory,
}: BudgetUsageChartProps) {
  const visibleItems = useMemo(
    () => (compact ? items.slice(0, 5) : items.slice(0, 10)),
    [items, compact]
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  const focusedItem = useMemo(
    () =>
      visibleItems.find((i) => i.budget.id === activeId) ??
      visibleItems[0] ??
      null,
    [visibleItems, activeId]
  );

  if (visibleItems.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#DCE4F0] bg-[#F4F7FB]/70 p-6 text-center text-xs text-slate-600 dark:border-[#1B3163] dark:bg-[#06132F]/60 dark:text-[#C7D0E0]/75">
        Belum ada kategori anggaran aktif pada periode ini untuk ditampilkan pada grafik.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend for threshold milestones */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-[#C7D0E0]/75">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#087BFF] dark:bg-[#19D8FF]" />
            <span>&lt;75% Aman / Info 50%</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span>≥75% Mendekati</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
            <span>≥90% Kritis</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span>≥100% Tercapai / Terlampaui</span>
          </span>
        </div>
        <span className="hidden font-mono text-[10px] text-slate-400 sm:inline">
          Garis ambang: 50% · 75% · 90% · 100%
        </span>
      </div>

      {/* Category progress bars with milestone ticks */}
      <div className="space-y-3">
        {visibleItems.map((item) => {
          const fillWidth = Math.min(100, Math.max(0, item.usagePct));
          const isSelected = focusedItem?.budget.id === item.budget.id;
          return (
            <button
              key={item.budget.id}
              type="button"
              onClick={() => {
                setActiveId(item.budget.id);
                onSelectCategory?.(item.budget.category);
              }}
              className={`block w-full rounded-xl border p-3 text-left transition-colors ${
                isSelected
                  ? "border-[#087BFF]/45 bg-[#087BFF]/5 dark:border-[#19D8FF]/45 dark:bg-[#19D8FF]/8"
                  : "border-[#DCE4F0]/80 bg-[#F4F7FB]/70 hover:border-[#087BFF]/35 dark:border-[#1B3163] dark:bg-[#06132F]/70"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-xs font-bold text-[#06132F] dark:text-white">
                    {item.budget.category}
                  </span>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${severityBadgeClass(
                      item.severity
                    )}`}
                  >
                    {item.shortLabel}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 font-mono text-xs tabular-nums">
                  <span className="font-bold text-[#06132F] dark:text-white">
                    {balanceHidden ? "••••" : formatIDR(item.spentAmount, true)}
                  </span>
                  <span className="text-slate-400">/</span>
                  <span className="text-slate-500 dark:text-[#C7D0E0]/75">
                    {balanceHidden ? "••••" : formatIDR(item.budget.limit_amount, true)}
                  </span>
                  <span className="ml-1 font-bold text-[#087BFF] dark:text-[#19D8FF]">
                    ({item.usagePct.toFixed(0)}%)
                  </span>
                </div>
              </div>

              <div className="relative mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200/90 dark:bg-[#10244D]">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${severityBarColor(
                    item.severity
                  )}`}
                  style={{ width: `${fillWidth}%` }}
                />
                {/* Threshold milestone guides */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-[50%] w-px bg-white/70 dark:bg-[#040B1C]/70"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-[75%] w-px bg-white/70 dark:bg-[#040B1C]/70"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-[90%] w-px bg-white/80 dark:bg-[#040B1C]/80"
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Focused detail summary strip */}
      {!compact && focusedItem ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-xs dark:border-[#1B3163] dark:bg-[#06132F]">
          <div className="flex items-center gap-2 text-[#06132F] dark:text-white">
            {focusedItem.severity === "exceeded_over" ||
            focusedItem.severity === "reached_100" ||
            focusedItem.severity === "high_90" ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />
            ) : focusedItem.severity === "warning_75" ? (
              <Info className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
            ) : (
              <CheckCircle2
                className="h-4 w-4 shrink-0 text-[#087BFF] dark:text-[#19D8FF]"
                aria-hidden="true"
              />
            )}
            <span>
              <strong>{focusedItem.budget.category}</strong>: {focusedItem.severityLabel} (
              {focusedItem.transactionCount} transaksi terkonfirmasi)
            </span>
          </div>
          <span className="font-mono font-bold tabular-nums text-[#06132F] dark:text-[#19D8FF]">
            {focusedItem.remainingAmount >= 0
              ? `Sisa ${balanceHidden ? "••••••" : formatIDR(focusedItem.remainingAmount)}`
              : `Lewat ${balanceHidden ? "••••••" : formatIDR(Math.abs(focusedItem.remainingAmount))}`}
          </span>
        </div>
      ) : null}
    </div>
  );
}
