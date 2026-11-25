import { Link } from "@tanstack/react-router";
import { ArrowRight, PieChart, Plus } from "lucide-react";
import { useMemo } from "react";
import { computeCategoryBreakdown, formatIDR } from "../../lib/finance";
import type { Transaction } from "../../types/ego";
import { CategoryIcon } from "./category-icon";

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
      ? "text-[#087BFF] dark:text-[#19D8FF]"
      : "text-rose-600 dark:text-rose-400";

  const wrapperClass = embedded
    ? "border-y border-[#DCE4F0] py-5 dark:border-[#1B3163]"
    : "flex h-full flex-col rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none";

  return (
    <section aria-label={title} className={wrapperClass}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[#06132F] dark:text-white">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-slate-600 dark:text-[#C7D0E0]/75">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div
          role="group"
          aria-label="Jenis rincian kategori"
          className="inline-flex self-start rounded-xl border border-[#DCE4F0] bg-[#EEF3FA] p-1 dark:border-[#1B3163] dark:bg-[#06132F] sm:self-auto"
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
                className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? tab.id === "income"
                      ? "bg-[#087BFF] text-white shadow-xs"
                      : "bg-rose-600 text-white shadow-xs dark:bg-rose-500"
                    : "text-slate-600 hover:text-[#06132F] dark:text-[#C7D0E0]/75 dark:hover:text-white"
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
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#19D8FF]/10 dark:text-[#19D8FF]">
            <PieChart className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm font-bold text-[#06132F] dark:text-white">
            Belum ada {type === "expense" ? "pengeluaran" : "pemasukan"} tercatat
          </p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-600 dark:text-[#C7D0E0]/75">
            Ringkasan muncul otomatis setelah transaksi Anda disetujui.
          </p>
          {showEmptyCta ? (
            onAddTransaction ? (
              <button
                type="button"
                onClick={onAddTransaction}
                className="mt-4 inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#087BFF] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0666DB]"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Catat Transaksi</span>
              </button>
            ) : (
              <Link
                to="/transaksi"
                className="mt-4 inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#087BFF] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0666DB]"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Catat Transaksi</span>
              </Link>
            )
          ) : null}
        </div>
      ) : (
        <div className="mt-4 flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-[#DCE4F0] pb-2.5 text-xs dark:border-[#1B3163]">
            <span className="text-slate-600 dark:text-[#C7D0E0]/75">
              Total {type === "expense" ? "Pengeluaran" : "Pemasukan"}
            </span>
            <div className="flex items-center gap-2 font-mono tabular-nums">
              <strong className={`font-bold ${amountColorClass}`}>
                {formatIDR(breakdown.totalAmount)}
              </strong>
              <span className="text-slate-400" aria-hidden="true">
                ·
              </span>
              <span className="text-slate-600 dark:text-[#C7D0E0]/75">
                {breakdown.totalCount} transaksi
              </span>
            </div>
          </div>

          <ul className="divide-y divide-[#DCE4F0]/70 dark:divide-[#1B3163]/70">
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
                        ? "bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]"
                        : "bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
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
                      <span className="truncate text-sm font-semibold text-[#06132F] dark:text-white">
                        {item.category}
                      </span>
                      <span className="shrink-0 font-mono text-sm font-bold text-[#06132F] dark:text-white tabular-nums">
                        {formatIDR(item.total)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-slate-500 font-mono tabular-nums dark:text-[#C7D0E0]/70">
                      <span>{item.count} transaksi</span>
                      <span>{pctFormatted}%</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#EEF3FA] dark:bg-[#06132F]">
                      <svg
                        viewBox="0 0 100 6"
                        preserveAspectRatio="none"
                        className="block h-full w-full"
                        aria-hidden="true"
                      >
                        <rect
                          x={0}
                          y={0}
                          width={Math.max(3, Math.min(100, item.percentage))}
                          height={6}
                          rx={3}
                          className={`${
                            type === "income"
                              ? "fill-[#087BFF] dark:fill-[#19D8FF]"
                              : "fill-rose-500"
                          } transition-all duration-200 motion-reduce:transition-none`}
                        />
                      </svg>
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
                      className={`group block w-full rounded-xl px-2.5 py-2 text-left transition-colors ${
                        isSelected
                          ? "bg-[#087BFF]/8 ring-1 ring-[#087BFF]/50 dark:bg-[#19D8FF]/10 dark:ring-[#19D8FF]/45"
                          : "hover:bg-[#F4F7FB] dark:hover:bg-[#06132F]/70"
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
            <div className="mt-auto flex items-center justify-between border-t border-[#DCE4F0] pt-3 text-xs text-slate-500 dark:border-[#1B3163] dark:text-[#C7D0E0]/70">
              <span>
                {hiddenCount > 0
                  ? `+${hiddenCount} kategori lainnya`
                  : "Ketuk kategori untuk menyaring riwayat"}
              </span>
              {!embedded ? (
                <Link
                  to="/transaksi"
                  search={{ jenis: type }}
                  className="inline-flex items-center gap-1 font-semibold text-[#087BFF] hover:text-[#0666DB] dark:text-[#19D8FF] dark:hover:text-cyan-300"
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
