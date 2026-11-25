import { useMemo, useState } from "react";
import { formatIDR } from "../../lib/finance";
import type { GoalScenarioProjectionPoint } from "../../types/ego";

interface GoalProjectionChartProps {
  series: GoalScenarioProjectionPoint[];
  targetAmount: number;
}

function computeNiceCeiling(maxVal: number): number {
  if (maxVal <= 0) return 1_000_000;
  const mag = 10 ** Math.floor(Math.log10(maxVal));
  const norm = maxVal / mag;
  let factor = 10;
  if (norm <= 1.2) factor = 1.2;
  else if (norm <= 1.5) factor = 1.5;
  else if (norm <= 2) factor = 2;
  else if (norm <= 3) factor = 3;
  else if (norm <= 5) factor = 5;
  else if (norm <= 8) factor = 8;
  return factor * mag;
}

export function GoalProjectionChart({ series, targetAmount }: GoalProjectionChartProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const safeIdx =
    selectedIdx !== null && selectedIdx >= 0 && selectedIdx < series.length
      ? selectedIdx
      : Math.max(0, series.length - 1);
  const activePoint = series[safeIdx] ?? null;

  const yMax = useMemo(() => {
    let maxVal = targetAmount;
    for (const p of series) {
      maxVal = Math.max(maxVal, p.conservative, p.normal, p.optimistic);
    }
    return computeNiceCeiling(maxVal);
  }, [series, targetAmount]);

  const svgWidth = 640;
  const svgHeight = 240;
  const padLeft = 74;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 32;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const xFor = (idx: number) => {
    if (series.length <= 1) return padLeft;
    return padLeft + (idx / (series.length - 1)) * plotW;
  };
  const yFor = (val: number) => {
    const ratio = yMax > 0 ? Math.min(1.05, Math.max(0, val / yMax)) : 0;
    return padTop + plotH - ratio * plotH;
  };

  const buildPath = (getter: (p: GoalScenarioProjectionPoint) => number) =>
    series
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${xFor(idx).toFixed(1)} ${yFor(getter(p)).toFixed(1)}`)
      .join(" ");

  const conservativePath = useMemo(() => buildPath((p) => p.conservative), [series, yMax]);
  const normalPath = useMemo(() => buildPath((p) => p.normal), [series, yMax]);
  const optimisticPath = useMemo(() => buildPath((p) => p.optimistic), [series, yMax]);

  const yTicks = [0, yMax * 0.5, yMax];
  const targetY = targetAmount > 0 ? yFor(targetAmount) : null;

  const labelStep = series.length <= 8 ? 1 : series.length <= 16 ? 2 : series.length <= 28 ? 4 : 6;

  return (
    <div className="space-y-3">
      {/* Interactive Month Inspector */}
      {activePoint ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-xs dark:border-[#1B3163] dark:bg-[#06132F]"
        >
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#19D8FF]" aria-hidden="true" />
            <span className="font-bold text-[#06132F] dark:text-white">
              {activePoint.label}
            </span>
            <span className="text-slate-400">·</span>
            <span className="font-mono text-slate-600 dark:text-[#C7D0E0]/75 tabular-nums">
              Bulan ke-{activePoint.monthIndex}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono tabular-nums">
            <span className="text-amber-600 dark:text-amber-300">
              Konservatif: <strong>{formatIDR(activePoint.conservative, true)}</strong>
            </span>
            <span className="text-[#087BFF] dark:text-[#19D8FF]">
              Normal: <strong>{formatIDR(activePoint.normal, true)}</strong>
            </span>
            <span className="text-emerald-600 dark:text-emerald-400">
              Optimistis: <strong>{formatIDR(activePoint.optimistic, true)}</strong>
            </span>
          </div>
        </div>
      ) : null}

      <div className="relative w-full overflow-hidden rounded-2xl border border-[#DCE4F0] bg-white p-2 dark:border-[#1B3163] dark:bg-[#06132F]/70">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="h-auto w-full select-none"
          role="img"
          aria-label="Grafik proyeksi tabungan 3 skenario"
          onMouseLeave={() => setSelectedIdx(null)}
        >
          {yTicks.map((tick, idx) => {
            const y = yFor(tick);
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
                  {tick === 0 ? "Rp 0" : formatIDR(tick, true)}
                </text>
              </g>
            );
          })}

          {targetY !== null ? (
            <g>
              <line
                x1={padLeft}
                x2={svgWidth - padRight}
                y1={targetY}
                y2={targetY}
                className="stroke-rose-500/80 dark:stroke-rose-400/80"
                strokeWidth={1.5}
                strokeDasharray="6 4"
              />
              <text
                x={svgWidth - padRight}
                y={Math.max(padTop + 10, targetY - 5)}
                textAnchor="end"
                className="fill-rose-600 dark:fill-rose-300"
                fontSize="10"
                fontWeight="700"
                fontFamily="JetBrains Mono, monospace"
              >
                Target {formatIDR(targetAmount, true)}
              </text>
            </g>
          ) : null}

          {/* Scenario lines */}
          <path
            d={conservativePath}
            fill="none"
            className="stroke-amber-500 dark:stroke-amber-400"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
          <path
            d={optimisticPath}
            fill="none"
            className="stroke-emerald-500 dark:stroke-emerald-400"
            strokeWidth={2}
            strokeDasharray="6 3"
          />
          <path
            d={normalPath}
            fill="none"
            className="stroke-[#087BFF] dark:stroke-[#19D8FF]"
            strokeWidth={3}
          />

          {/* Interactive hit points & X labels */}
          {series.map((p, idx) => {
            const cx = xFor(idx);
            const isSelected = safeIdx === idx;
            const tooCloseToEnd =
              idx !== 0 &&
              idx !== series.length - 1 &&
              series.length - 1 - idx < Math.max(2, Math.ceil(labelStep * 0.75));
            const showLabel =
              idx === 0 ||
              idx === series.length - 1 ||
              (!tooCloseToEnd && idx % labelStep === 0);
            const slotW = series.length > 1 ? plotW / (series.length - 1) : plotW;
            return (
              <g
                key={p.monthIndex}
                tabIndex={0}
                role="button"
                aria-label={`${p.label}: Normal ${formatIDR(p.normal)}`}
                className="cursor-pointer outline-none"
                onMouseEnter={() => setSelectedIdx(idx)}
                onFocus={() => setSelectedIdx(idx)}
                onClick={() => setSelectedIdx(idx)}
              >
                <rect
                  x={cx - Math.max(8, slotW / 2)}
                  y={padTop}
                  width={Math.max(16, slotW)}
                  height={plotH}
                  fill="transparent"
                />
                {isSelected ? (
                  <>
                    <line
                      x1={cx}
                      x2={cx}
                      y1={padTop}
                      y2={padTop + plotH}
                      className="stroke-[#087BFF]/40 dark:stroke-[#19D8FF]/40"
                      strokeWidth={1}
                    />
                    <circle
                      cx={cx}
                      cy={yFor(p.conservative)}
                      r={3.5}
                      className="fill-amber-500"
                    />
                    <circle
                      cx={cx}
                      cy={yFor(p.normal)}
                      r={4.5}
                      className="fill-[#087BFF] stroke-white dark:fill-[#19D8FF] dark:stroke-[#06132F]"
                      strokeWidth={2}
                    />
                    <circle
                      cx={cx}
                      cy={yFor(p.optimistic)}
                      r={3.5}
                      className="fill-emerald-500"
                    />
                  </>
                ) : null}

                {showLabel ? (
                  <text
                    x={cx}
                    y={svgHeight - 8}
                    textAnchor={
                      idx === 0
                        ? "start"
                        : idx === series.length - 1
                          ? "end"
                          : "middle"
                    }
                    className={
                      isSelected
                        ? "fill-[#06132F] dark:fill-white"
                        : "fill-slate-500 dark:fill-[#C7D0E0]/65"
                    }
                    fontSize="10"
                    fontWeight={isSelected ? "700" : "500"}
                  >
                    {p.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600 dark:text-[#C7D0E0]/80">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-amber-500" aria-hidden="true" />
          Konservatif
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold text-[#06132F] dark:text-white">
          <span className="inline-block h-1 w-4 rounded bg-[#087BFF] dark:bg-[#19D8FF]" aria-hidden="true" />
          Normal (Utama)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-emerald-500" aria-hidden="true" />
          Optimistis
        </span>
        {targetAmount > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 border-b-2 border-dashed border-rose-500" aria-hidden="true" />
            Target Dana
          </span>
        ) : null}
      </div>
    </div>
  );
}
