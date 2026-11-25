import { BarChart3, Bot, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { computeCashflowSeries, formatIDR } from "../../lib/finance";
import type { Transaction } from "../../types/ego";

interface CashflowChartProps {
  transactions: Transaction[];
  monthsCount: 3 | 6 | 12;
  onMonthsCountChange: (months: 3 | 6 | 12) => void;
  referenceMonth?: string;
  onAddTransaction?: () => void;
}

const RANGE_OPTIONS: Array<{ value: 3 | 6 | 12; label: string }> = [
  { value: 3, label: "3 Bln" },
  { value: 6, label: "6 Bln" },
  { value: 12, label: "12 Bln" },
];

function computeNiceMax(maxValue: number): number {
  if (maxValue <= 0) return 1_000_000;
  const magnitude = 10 ** Math.floor(Math.log10(maxValue));
  const normalized = maxValue / magnitude;
  let niceFactor = 10;
  if (normalized <= 1.2) niceFactor = 1.2;
  else if (normalized <= 1.5) niceFactor = 1.5;
  else if (normalized <= 2) niceFactor = 2;
  else if (normalized <= 2.5) niceFactor = 2.5;
  else if (normalized <= 5) niceFactor = 5;
  else if (normalized <= 8) niceFactor = 8;
  return niceFactor * magnitude;
}

export function CashflowChart({
  transactions,
  monthsCount,
  onMonthsCountChange,
  referenceMonth,
  onAddTransaction,
}: CashflowChartProps) {
  const series = useMemo(
    () => computeCashflowSeries(transactions, monthsCount, referenceMonth),
    [transactions, monthsCount, referenceMonth]
  );

  const periodTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const point of series) {
      income += point.income;
      expense += point.expense;
    }
    return {
      income,
      expense,
      net: income - expense,
      hasData: income > 0 || expense > 0,
    };
  }, [series]);

  const [hoveredMonthKey, setHoveredMonthKey] = useState<string | null>(null);

  const defaultMonthKey = useMemo(() => {
    const reversed = [...series].reverse();
    const withData = reversed.find((p) => p.income > 0 || p.expense > 0);
    return withData?.monthKey ?? series[series.length - 1]?.monthKey ?? null;
  }, [series]);

  const activePoint = useMemo(() => {
    const key = hoveredMonthKey ?? defaultMonthKey;
    return series.find((p) => p.monthKey === key) ?? series[series.length - 1] ?? null;
  }, [series, hoveredMonthKey, defaultMonthKey]);

  const activeIndex = useMemo(() => {
    if (!activePoint) return -1;
    return series.findIndex((p) => p.monthKey === activePoint.monthKey);
  }, [series, activePoint]);

  const maxRaw = useMemo(() => {
    let m = 0;
    for (const p of series) {
      if (p.income > m) m = p.income;
      if (p.expense > m) m = p.expense;
    }
    return m;
  }, [series]);

  const niceMax = computeNiceMax(maxRaw);

  const svgWidth = 640;
  const svgHeight = 230;
  const padLeft = 74;
  const padRight = 14;
  const padTop = 18;
  const padBottom = 30;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;
  const slotWidth = plotWidth / series.length;
  const barWidth = Math.min(20, Math.max(8, Math.floor((slotWidth - 10) / 2)));
  const barGap = monthsCount === 12 ? 3 : 5;

  const yTicks = [0, niceMax * 0.5, niceMax];

  return (
    <section
      aria-label="Arus Kas Bulanan"
      className="flex h-full flex-col rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-[#06132F] dark:text-white">
            Arus Kas Bulanan
          </h2>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-[#C7D0E0]/75">
            Pemasukan vs pengeluaran terposting ({monthsCount} bulan terakhir)
          </p>
        </div>

        <div
          role="group"
          aria-label="Filter periode grafik"
          className="inline-flex self-start rounded-xl border border-[#DCE4F0] bg-[#EEF3FA] p-1 dark:border-[#1B3163] dark:bg-[#06132F] sm:self-auto"
        >
          {RANGE_OPTIONS.map((opt) => {
            const active = monthsCount === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() => onMonthsCountChange(opt.value)}
                className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? "bg-[#087BFF] text-white shadow-xs"
                    : "text-slate-600 hover:text-[#06132F] dark:text-[#C7D0E0]/75 dark:hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Period summary strip */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 border-y border-[#DCE4F0] py-3.5 text-xs dark:border-[#1B3163] sm:grid-cols-3 sm:gap-4">
        <div className="flex items-center justify-between sm:block">
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-[#C7D0E0]/75">
            <span
              className="inline-block h-2 w-2 rounded-xs bg-[#087BFF] dark:bg-[#19D8FF]"
              aria-hidden="true"
            />
            Pemasukan
          </span>
          <p className="font-mono text-sm font-bold text-[#087BFF] dark:text-[#19D8FF] tabular-nums sm:mt-0.5">
            {formatIDR(periodTotals.income)}
          </p>
        </div>

        <div className="flex items-center justify-between sm:block">
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-[#C7D0E0]/75">
            <span
              className="inline-block h-2 w-2 rounded-xs bg-rose-500"
              aria-hidden="true"
            />
            Pengeluaran
          </span>
          <p className="font-mono text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums sm:mt-0.5">
            {formatIDR(periodTotals.expense)}
          </p>
        </div>

        <div className="flex items-center justify-between sm:block sm:text-right">
          <span className="text-slate-600 dark:text-[#C7D0E0]/75">Selisih Periode</span>
          <p
            className={`font-mono text-sm font-bold tabular-nums sm:mt-0.5 ${
              periodTotals.net >= 0
                ? "text-[#087BFF] dark:text-[#19D8FF]"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {formatIDR(periodTotals.net)}
          </p>
        </div>
      </div>

      {!periodTotals.hasData ? (
        <div className="mt-4 flex flex-1 flex-col items-center justify-center py-8 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#19D8FF]/10 dark:text-[#19D8FF]">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm font-bold text-[#06132F] dark:text-white">
            Belum ada arus kas pada periode ini
          </p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-600 dark:text-[#C7D0E0]/75">
            Grafik terisi otomatis setelah transaksi pemasukan atau pengeluaran disetujui.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {onAddTransaction ? (
              <button
                type="button"
                onClick={onAddTransaction}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#087BFF] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0666DB]"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Catat Transaksi</span>
              </button>
            ) : (
              <Link
                to="/transaksi"
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#087BFF] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0666DB]"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Catat Transaksi</span>
              </Link>
            )}
            <Link
              to="/owner"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2 text-xs font-semibold text-[#06132F] hover:bg-slate-100 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0] dark:hover:bg-[#0D1E45]"
            >
              <Bot className="h-3.5 w-3.5 text-[#087BFF] dark:text-[#19D8FF]" aria-hidden="true" />
              <span>Tanya EGO AI</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-1 flex-col justify-between">
          {/* Interactive Tooltip Pill above chart for instant readability */}
          {activePoint ? (
            <div
              role="status"
              aria-live="polite"
              className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2 text-xs dark:border-[#1B3163] dark:bg-[#06132F]"
            >
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-[#19D8FF]" aria-hidden="true" />
                <span className="font-bold text-[#06132F] dark:text-white">
                  {activePoint.label}
                </span>
                <span className="text-slate-400" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono text-slate-600 dark:text-[#C7D0E0]/75 tabular-nums">
                  {activePoint.transactionCount} transaksi
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono tabular-nums">
                <span className="font-semibold text-[#087BFF] dark:text-[#19D8FF]">
                  +{formatIDR(activePoint.income)}
                </span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  -{formatIDR(activePoint.expense)}
                </span>
                <span
                  className={`font-bold ${
                    activePoint.net >= 0
                      ? "text-[#06132F] dark:text-white"
                      : "text-rose-700 dark:text-rose-300"
                  }`}
                >
                  Bersih {formatIDR(activePoint.net)}
                </span>
              </div>
            </div>
          ) : null}

          <div className="relative w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="h-auto w-full select-none"
              role="img"
              aria-label={`Grafik batang arus kas ${monthsCount} bulan terakhir`}
              onMouseLeave={() => setHoveredMonthKey(null)}
            >
              {yTicks.map((tickVal, idx) => {
                const ratio = niceMax > 0 ? tickVal / niceMax : 0;
                const y = padTop + plotHeight - ratio * plotHeight;
                return (
                  <g key={idx}>
                    <line
                      x1={padLeft}
                      x2={svgWidth - padRight}
                      y1={y}
                      y2={y}
                      className={
                        idx === 0
                          ? "stroke-[#CBD5E1] dark:stroke-[#233E7A]"
                          : "stroke-[#E2E8F0] dark:stroke-[#14254E]"
                      }
                      strokeWidth={1}
                      strokeDasharray={idx === 0 ? undefined : "3 3"}
                    />
                    <text
                      x={padLeft - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-500 dark:fill-[#C7D0E0]/70"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {tickVal === 0 ? "Rp 0" : formatIDR(tickVal, true)}
                    </text>
                  </g>
                );
              })}

              {series.map((point, index) => {
                const slotX = padLeft + index * slotWidth;
                const centerX = slotX + slotWidth / 2;
                const incomeHeight =
                  point.income > 0
                    ? Math.max(4, (point.income / niceMax) * plotHeight)
                    : 0;
                const expenseHeight =
                  point.expense > 0
                    ? Math.max(4, (point.expense / niceMax) * plotHeight)
                    : 0;

                const incomeX = centerX - barGap / 2 - barWidth;
                const expenseX = centerX + barGap / 2;
                const incomeY = padTop + plotHeight - incomeHeight;
                const expenseY = padTop + plotHeight - expenseHeight;
                const isActive = activeIndex === index;

                return (
                  <g
                    key={point.monthKey}
                    tabIndex={0}
                    role="button"
                    aria-label={`${point.label}: Pemasukan ${formatIDR(
                      point.income
                    )}, Pengeluaran ${formatIDR(point.expense)}, Selisih ${formatIDR(
                      point.net
                    )}`}
                    className="cursor-pointer outline-none"
                    onMouseEnter={() => setHoveredMonthKey(point.monthKey)}
                    onFocus={() => setHoveredMonthKey(point.monthKey)}
                    onClick={() => setHoveredMonthKey(point.monthKey)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setHoveredMonthKey(point.monthKey);
                      }
                    }}
                  >
                    <rect
                      x={slotX + 2}
                      y={padTop}
                      width={Math.max(0, slotWidth - 4)}
                      height={plotHeight}
                      rx={8}
                      className={
                        isActive
                          ? "fill-[#087BFF]/8 dark:fill-[#19D8FF]/10"
                          : "fill-transparent"
                      }
                    />

                    {incomeHeight > 0 ? (
                      <rect
                        x={incomeX}
                        y={incomeY}
                        width={barWidth}
                        height={incomeHeight}
                        rx={4}
                        className="fill-[#087BFF] dark:fill-[#19D8FF] transition-opacity duration-150 motion-reduce:transition-none"
                        opacity={isActive ? 1 : 0.85}
                      />
                    ) : (
                      <rect
                        x={incomeX}
                        y={padTop + plotHeight - 2}
                        width={barWidth}
                        height={2}
                        rx={1}
                        className="fill-slate-200 dark:fill-[#1B3163]"
                      />
                    )}

                    {expenseHeight > 0 ? (
                      <rect
                        x={expenseX}
                        y={expenseY}
                        width={barWidth}
                        height={expenseHeight}
                        rx={4}
                        className="fill-rose-500 transition-opacity duration-150 motion-reduce:transition-none"
                        opacity={isActive ? 1 : 0.85}
                      />
                    ) : (
                      <rect
                        x={expenseX}
                        y={padTop + plotHeight - 2}
                        width={barWidth}
                        height={2}
                        rx={1}
                        className="fill-slate-200 dark:fill-[#1B3163]"
                      />
                    )}

                    <text
                      x={centerX}
                      y={svgHeight - 8}
                      textAnchor="middle"
                      className={
                        isActive
                          ? "fill-[#06132F] dark:fill-white"
                          : "fill-slate-500 dark:fill-[#C7D0E0]/65"
                      }
                      fontSize={monthsCount === 12 ? "10" : "11"}
                      fontWeight={isActive ? "700" : "500"}
                    >
                      {point.shortLabel}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-[#C7D0E0]/60">
            Ketuk atau arahkan kursor pada batang bulan untuk melihat rincian arus kas.
          </p>
        </div>
      )}
    </section>
  );
}
