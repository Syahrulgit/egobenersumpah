import { motion } from "motion/react";
import { useId, useMemo, useState } from "react";
import { formatIDR } from "../../lib/finance";
import type { CashflowForecastResult } from "../../lib/cashflow-forecast";
import { EGO_EASE, useRevealOnce } from "./ego-motion";

interface CashflowForecastChartProps {
  forecast: CashflowForecastResult;
  balanceHidden?: boolean;
}

export function CashflowForecastChart({
  forecast,
  balanceHidden = false,
}: CashflowForecastChartProps) {
  const fillId = useId();
  const series = forecast.dailySeries;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const { ref: chartRef, revealed } = useRevealOnce<HTMLDivElement>(0.08);

  const activeIndex =
    hoverIdx !== null && hoverIdx >= 0 && hoverIdx < series.length
      ? hoverIdx
      : series.length - 1;
  const activePoint = series[activeIndex] ?? series[0];

  const { minVal, maxVal, zeroY, polylinePoints, areaPoints, pointsMeta } =
    useMemo(() => {
      const width = 640;
      const height = 210;
      const padLeft = 14;
      const padRight = 14;
      const padTop = 18;
      const padBottom = 26;
      const plotW = width - padLeft - padRight;
      const plotH = height - padTop - padBottom;

      const values = series.map((p) => p.balance);
      const rawMin = Math.min(0, ...values);
      const rawMax = Math.max(100_000, ...values);
      const span = Math.max(100_000, rawMax - rawMin);
      const minV = rawMin - span * 0.08;
      const maxV = rawMax + span * 0.08;
      const totalRange = Math.max(1, maxV - minV);

      const toX = (idx: number) =>
        series.length <= 1
          ? padLeft + plotW / 2
          : padLeft + (idx / (series.length - 1)) * plotW;
      const toY = (val: number) =>
        padTop + ((maxV - val) / totalRange) * plotH;

      const zY = toY(0);
      const meta = series.map((pt, idx) => ({
        idx,
        x: Math.round(toX(idx) * 10) / 10,
        y: Math.round(toY(pt.balance) * 10) / 10,
        point: pt,
      }));

      const poly = meta.map((m) => `${m.x},${m.y}`).join(" ");
      const firstX = meta[0]?.x ?? padLeft;
      const lastX = meta[meta.length - 1]?.x ?? padLeft + plotW;
      const clampedBottomY = Math.min(height - padBottom, Math.max(padTop, zY));
      const area = `${firstX},${clampedBottomY} ${poly} ${lastX},${clampedBottomY}`;

      return {
        minVal: minV,
        maxVal: maxV,
        zeroY: zY,
        polylinePoints: poly,
        areaPoints: area,
        pointsMeta: meta,
      };
    }, [series]);

  const sampledTicks = useMemo(() => {
    const indices = [
      0,
      Math.floor((series.length - 1) * 0.33),
      Math.floor((series.length - 1) * 0.66),
      series.length - 1,
    ];
    return Array.from(new Set(indices));
  }, [series.length]);

  if (series.length === 0) {
    return null;
  }

  const activeMeta = pointsMeta[activeIndex] ?? pointsMeta[pointsMeta.length - 1];
  const masked = "Rp ••••••";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs dark:border-[#1E293B] dark:bg-[#0B111E]">
        <div>
          <span className="font-semibold text-slate-500 dark:text-slate-400">
            Titik Fokus ({activePoint?.dateISO ?? "—"}):{" "}
          </span>
          <span
            className={`font-mono font-bold tabular-nums ${
              (activePoint?.balance ?? 0) < 0
                ? "text-[#DC2626] dark:text-[#F87171]"
                : activePoint?.isTightBuffer
                  ? "text-amber-600 dark:text-amber-300"
                  : "text-[#9A7411] dark:text-[#E6C768]"
            }`}
          >
            {balanceHidden ? masked : formatIDR(activePoint?.balance ?? 0)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300">
          <span>
            Terjadwal:{" "}
            <strong className="font-mono">
              {balanceHidden
                ? "••••"
                : `${(activePoint?.scheduledNet ?? 0) >= 0 ? "+" : ""}${formatIDR(
                    activePoint?.scheduledNet ?? 0,
                    true
                  )}`}
            </strong>
          </span>
          <span>
            Estimasi:{" "}
            <strong className="font-mono">
              {balanceHidden
                ? "••••"
                : `${(activePoint?.estimatedNet ?? 0) >= 0 ? "+" : ""}${formatIDR(
                    activePoint?.estimatedNet ?? 0,
                    true
                  )}`}
            </strong>
          </span>
        </div>
      </div>

      <div
        ref={chartRef}
        className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 dark:border-[#1E293B] dark:bg-[#0B111E]"
      >
        <svg
          viewBox="0 0 640 210"
          role="img"
          aria-label={`Grafik proyeksi saldo ${forecast.horizonDays} hari`}
          className="h-48 w-full select-none sm:h-56"
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          <line
            x1="14"
            y1="18"
            x2="626"
            y2="18"
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeDasharray="3 4"
          />
          <line
            x1="14"
            y1="101"
            x2="626"
            y2="101"
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeDasharray="3 4"
          />
          {minVal < 0 && maxVal > 0 ? (
            <line
              x1="14"
              y1={zeroY}
              x2="626"
              y2={zeroY}
              stroke="#EF4444"
              strokeWidth="1.2"
              strokeDasharray="4 4"
              strokeOpacity="0.7"
            />
          ) : null}

          <motion.polygon
            points={areaPoints}
            fill={`url(#${fillId})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: revealed ? 1 : 0 }}
            transition={{ duration: 0.45, ease: EGO_EASE }}
          />
          <motion.polyline
            fill="none"
            stroke="#D4AF37"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylinePoints}
            initial={{ pathLength: 0, opacity: 0.4 }}
            animate={{ pathLength: revealed ? 1 : 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: EGO_EASE }}
          />

          {pointsMeta
            .filter((m) => m.point.isDeficit)
            .map((m) => (
              <circle
                key={`def-${m.idx}`}
                cx={m.x}
                cy={m.y}
                r="2.5"
                fill="#EF4444"
              />
            ))}

          {activeMeta ? (
            <g>
              <line
                x1={activeMeta.x}
                y1="18"
                x2={activeMeta.x}
                y2="184"
                stroke="#D4AF37"
                strokeOpacity="0.6"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={activeMeta.x}
                cy={activeMeta.y}
                r="5"
                fill={activeMeta.point.isDeficit ? "#EF4444" : "#E6C768"}
                stroke="#101827"
                strokeWidth="2"
              />
            </g>
          ) : null}

          {sampledTicks.map((idx) => {
            const m = pointsMeta[idx];
            if (!m) return null;
            return (
              <text
                key={`tick-${idx}`}
                x={m.x}
                y="202"
                textAnchor={
                  idx === 0
                    ? "start"
                    : idx === series.length - 1
                      ? "end"
                      : "middle"
                }
                className="fill-slate-400 text-[10px] font-mono dark:fill-slate-400"
              >
                {m.point.label}
              </text>
            );
          })}

          {pointsMeta.map((m) => {
            const sliceW = Math.max(4, 612 / Math.max(1, pointsMeta.length));
            return (
              <rect
                key={`hit-${m.idx}`}
                x={Math.max(14, m.x - sliceW / 2)}
                y="14"
                width={sliceW}
                height="174"
                fill="transparent"
                onMouseEnter={() => setHoverIdx(m.idx)}
                onClick={() => setHoverIdx(m.idx)}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
