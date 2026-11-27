import { Link } from "@tanstack/react-router";
import { ArrowRight, PieChart, Plus } from "lucide-react";
import { useMemo } from "react";
import { computeCategoryBreakdown, formatIDR } from "../../lib/finance";
import type { Transaction } from "../../types/ego";
import { CategoryIcon } from "./category-icon";
import { EgoAnimatedBar, EgoCountUp } from "./ego-motion";

interface CategoryBreakdownProps {
  transactions: Transaction[];
  title: string;
  subtitle?: string;
  type: "income" | "expense";
  onTypeChange: (type: "income" | "expense") => void;
  yearMonth?: string;
  fromDate?: string;
  toDate?: string;
  selectedCategory?: string;
  onSelectCategory?: (category: string, type: "income" | "expense") => void;
  maxItems?: number;
  embedded?: boolean;
  showEmptyCta?: boolean;
  onAddTransaction?: () => void;
}

export function CategoryBreakdown({
  transactions,
  title,
  subtitle,
  type,
  onTypeChange,
  yearMonth,
  fromDate,
  toDate,
  selectedCategory,
  onSelectCategory,
  maxItems = 6,
  embedded = false,
  showEmptyCta = true,
  onAddTransaction,
}: CategoryBreakdownProps) {
  const breakdown = useMemo(
    () =>
      computeCategoryBreakdown(transactions, type, {
        yearMonth,
        fromDate,
        toDate,
      }),
    [transactions, type, yearMonth, fromDate, toDate]
  );

  const visibleItems = breakdown.items.slice(0, maxItems);
  const hiddenCount = Math.max(0, breakdown.items.length - visibleItems.length);
  const amountColorClass =
    type === "income"
      ? "text-[#0D9488] dark:text-[#2DD4BF]"
      : "text-[#DC2626] dark:text-[#F87171]";

  const wrapperClass = embedded
    ? "border-y border-slate-200 py-5 dark:border-[#1E293B]"
    : "flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none";

  return (
    <section aria-label={title} className={wrapperClass}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[#101827] dark:text-white">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div
          role="group"
          aria-label="Jenis rincian kategori"
          className="inline-flex self-start rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-[#1E293B] dark:bg-[#0B111E] sm:self-auto"
        >
          {(
            [
              { id: "expense", label: "Pengeluaran" },
              { id: "income", label: "Pemasukan" },
            ] as const
          ).map((tab) => {
            const active = type === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => onTypeChange(tab.id)}
                className={`ego-pressable min-h-[36px] rounded-lg px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? tab.id === "income"
                      ? "bg-[#14B8A6] text-white shadow-xs"
                      : "bg-[#EF4444] text-white shadow-xs"
                    : "text-slate-600 hover:text-[#101827] dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {breakdown.items.length === 0 ? (
        <div className="mt-4 flex flex-1 flex-col items-center justify-center py-8 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#101827] text-[#E6C768] dark:bg-[#D4AF37]/15">
            <PieChart className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm font-bold text-[#101827] dark:text-white">
            Belum ada {type === "expense" ? "pengeluaran" : "pemasukan"} tercatat
          </p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Ringkasan muncul otomatis setelah transaksi Anda disetujui.
          </p>
          {showEmptyCta ? (
            onAddTransaction ? (
              <button
                type="button"
                onClick={onAddTransaction}
                className="mt-4 inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#E6C768] to-[#D4AF37] px-4 py-2 text-xs font-bold text-[#101827] transition-all hover:brightness-105"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Catat Transaksi</span>
              </button>
            ) : (
              <Link
                to="/transaksi"
                className="mt-4 inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#E6C768] to-[#D4AF37] px-4 py-2 text-xs font-bold text-[#101827] transition-all hover:brightness-105"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Catat Transaksi</span>
              </Link>
            )
          ) : null}
        </div>
      ) : (
        <div className="mt-4 flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 text-xs dark:border-[#1E293B]">
            <span className="text-slate-600 dark:text-slate-400">
              Total {type === "expense" ? "Pengeluaran" : "Pemasukan"}
            </span>
            <div className="flex items-center gap-2 font-mono tabular-nums">
              <strong className={`font-bold ${amountColorClass}`}>
                <EgoCountUp value={breakdown.totalAmount} formatter={(v) => formatIDR(v)} />
              </strong>
              <span className="text-slate-400" aria-hidden="true">
                ·
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                {breakdown.totalCount} transaksi
              </span>
            </div>
          </div>

          <ul className="divide-y divide-slate-200/70 dark:divide-[#1E293B]">
            {visibleItems.map((item) => {
              const pctFormatted = item.percentage
                .toFixed(1)
                .replace(/\.0$/, "")
                .replace(".", ",");
              const isSelected =
                Boolean(selectedCategory) &&
                selectedCategory?.trim().toLowerCase() ===
                  item.category.toLowerCase();

              const content = (
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                      type === "income"
                        ? "bg-[#14B8A6]/12 text-[#0D9488] dark:bg-[#14B8A6]/15 dark:text-[#2DD4BF]"
                        : "bg-[#EF4444]/10 text-[#DC2626] dark:bg-[#EF4444]/15 dark:text-[#F87171]"
                    }`}
                  >
                    <CategoryIcon
                      category={item.category}
                      transactionType={type}
                      className="h-4 w-4"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-[#101827] dark:text-white">
                        {item.category}
                      </span>
                      <span className="shrink-0 font-mono text-sm font-bold text-[#101827] dark:text-white tabular-nums">
                        {formatIDR(item.total)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-slate-500 font-mono tabular-nums dark:text-slate-400">
                      <span>{item.count} transaksi</span>
                      <span>{pctFormatted}%</span>
                    </div>
                    <div className="mt-2">
                      <EgoAnimatedBar
                        percentage={Math.max(3, Math.min(100, item.percentage))}
                        heightClassName="h-1.5"
                        trackClassName="bg-slate-100 dark:bg-[#0B111E]"
                        barClassName={
                          type === "income" ? "bg-[#14B8A6]" : "bg-[#EF4444]"
                        }
                      />
                    </div>
                  </div>
                </div>
              );

              return (
                <li key={item.category} className="py-2 first:pt-2.5 last:pb-1">
                  {onSelectCategory ? (
                    <button
                      type="button"
                      onClick={() => onSelectCategory(item.category, type)}
                      aria-pressed={isSelected}
                      aria-label={`Filter kategori ${item.category}, ${formatIDR(
                        item.total
                      )}, ${pctFormatted}%`}
                      className={`ego-pressable group block w-full rounded-xl px-2.5 py-2 text-left transition-colors ${
                        isSelected
                          ? "bg-[#D4AF37]/10 ring-1 ring-[#D4AF37]/60 dark:bg-[#D4AF37]/12 dark:ring-[#D4AF37]/50"
                          : "hover:bg-slate-50 dark:hover:bg-[#162032]"
                      }`}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="px-1 py-1">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>

          {hiddenCount > 0 || onSelectCategory ? (
            <div className="mt-auto flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-[#1E293B] dark:text-slate-400">
              <span>
                {hiddenCount > 0
                  ? `+${hiddenCount} kategori lainnya`
                  : "Ketuk kategori untuk menyaring riwayat"}
              </span>
              {!embedded ? (
                <Link
                  to="/transaksi"
                  search={{ jenis: type }}
                  className="inline-flex items-center gap-1 font-semibold text-[#9A7411] hover:text-[#101827] dark:text-[#E6C768] dark:hover:text-white"
                >
                  <span>Lihat Semua</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
