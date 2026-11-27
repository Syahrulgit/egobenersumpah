import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useMemo, useState } from "react";
import type { EvaluatedBudget } from "../../lib/budgets";
import { formatIDR } from "../../lib/finance";
import type { BudgetSeverityLevel } from "../../types/ego";
import { EgoAnimatedBar } from "./ego-motion";

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
      return "bg-gradient-to-r from-[#EF4444] to-[#DC2626]";
    case "high_90":
      return "bg-gradient-to-r from-orange-500 to-[#EF4444]";
    case "warning_75":
      return "bg-gradient-to-r from-[#D4AF37] to-amber-500";
    case "info_50":
      return "bg-gradient-to-r from-[#B8901F] to-[#D4AF37]";
    case "inactive":
      return "bg-slate-300 dark:bg-slate-600";
    default:
      return "bg-gradient-to-r from-[#0D9488] to-[#14B8A6]";
  }
}

export function severityBadgeClass(severity: BudgetSeverityLevel): string {
  switch (severity) {
    case "exceeded_over":
    case "reached_100":
      return "bg-[#EF4444]/15 text-[#DC2626] dark:bg-[#EF4444]/20 dark:text-[#F87171]";
    case "high_90":
      return "bg-orange-500/15 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300";
    case "warning_75":
      return "bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300";
    case "info_50":
      return "bg-[#D4AF37]/15 text-[#9A7411] dark:bg-[#D4AF37]/20 dark:text-[#E6C768]";
    case "inactive":
      return "bg-slate-200/80 text-slate-600 dark:bg-[#162032] dark:text-slate-400";
    default:
      return "bg-[#14B8A6]/15 text-[#0D9488] dark:bg-[#14B8A6]/20 dark:text-[#2DD4BF]";
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
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-600 dark:border-[#1E293B] dark:bg-[#0B111E]/70 dark:text-slate-400">
        Belum ada kategori anggaran aktif pada periode ini untuk ditampilkan pada grafik.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#14B8A6]" />
            <span>&lt;50% Aman</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#D4AF37]" />
            <span>50–89% Terpantau</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
            <span>≥90% Kritis</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" />
            <span>≥100% Tercapai / Lewat</span>
          </span>
        </div>
        <span className="hidden font-mono text-[10px] text-slate-400 sm:inline">
          Garis ambang: 50% · 75% · 90% · 100%
        </span>
      </div>

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
              className={`ego-pressable block w-full rounded-xl border p-3 text-left transition-colors ${
                isSelected
                  ? "border-[#D4AF37]/60 bg-[#D4AF37]/8 dark:border-[#D4AF37]/50 dark:bg-[#D4AF37]/10"
                  : "border-slate-200 bg-slate-50/70 hover:border-[#D4AF37]/40 dark:border-[#1E293B] dark:bg-[#0B111E]/70"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-xs font-bold text-[#101827] dark:text-white">
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
                  <span className="font-bold text-[#101827] dark:text-white">
                    {balanceHidden ? "••••" : formatIDR(item.spentAmount, true)}
                  </span>
                  <span className="text-slate-400">/</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {balanceHidden ? "••••" : formatIDR(item.budget.limit_amount, true)}
                  </span>
                  <span className="ml-1 font-bold text-[#9A7411] dark:text-[#E6C768]">
                    ({item.usagePct.toFixed(0)}%)
                  </span>
                </div>
              </div>

              <div className="relative mt-2">
                <EgoAnimatedBar
                  percentage={fillWidth}
                  heightClassName="h-2.5"
                  barClassName={severityBarColor(item.severity)}
                  ariaLabel={`Pemakaian anggaran ${item.budget.category}`}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-[50%] w-px bg-white/75 dark:bg-[#0B111E]/80"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-[75%] w-px bg-white/75 dark:bg-[#0B111E]/80"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-[90%] w-px bg-white/85 dark:bg-[#0B111E]/85"
                />
              </div>
            </button>
          );
        })}
      </div>

      {!compact && focusedItem ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs dark:border-[#1E293B] dark:bg-[#0B111E]">
          <div className="flex items-center gap-2 text-[#101827] dark:text-white">
            {focusedItem.severity === "exceeded_over" ||
            focusedItem.severity === "reached_100" ||
            focusedItem.severity === "high_90" ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-[#EF4444]" aria-hidden="true" />
            ) : focusedItem.severity === "warning_75" ? (
              <Info className="h-4 w-4 shrink-0 text-[#D4AF37]" aria-hidden="true" />
            ) : (
              <CheckCircle2
                className="h-4 w-4 shrink-0 text-[#14B8A6]"
                aria-hidden="true"
              />
            )}
            <span>
              <strong>{focusedItem.budget.category}</strong>: {focusedItem.severityLabel} (
              {focusedItem.transactionCount} transaksi terkonfirmasi)
            </span>
          </div>
          <span className="font-mono font-bold tabular-nums text-[#101827] dark:text-[#E6C768]">
            {focusedItem.remainingAmount >= 0
              ? `Sisa ${balanceHidden ? "••••••" : formatIDR(focusedItem.remainingAmount)}`
              : `Lewat ${balanceHidden ? "••••••" : formatIDR(Math.abs(focusedItem.remainingAmount))}`}
          </span>
        </div>
      ) : null}
    </div>
  );
}
