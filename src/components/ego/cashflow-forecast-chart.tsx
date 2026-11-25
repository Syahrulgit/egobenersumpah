import { useMemo, useState } from "react";
import { formatIDR } from "../../lib/finance";
import type { CashflowForecastResult } from "../../lib/cashflow-forecast";

interface CashflowForecastChartProps {
  forecast: CashflowForecastResult;
  balanceHidden?: boolean;
}

export function CashflowForecastChart({
  forecast,
  balanceHidden = false,
}: CashflowForecastChartProps) {
  const series = forecast.dailySeries;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

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

  if (series.length === 0) {
    return null;
  }

  const sampledTicks = useMemo(() => {
    const indices = [
      0,
      Math.floor((series.length - 1) * 0.33),
      Math.floor((series.length - 1) * 0.66),
      series.length - 1,
    ];
    return Array.from(new Set(indices));
  }, [series.length]);

  const activeMeta = pointsMeta[activeIndex] ?? pointsMeta[pointsMeta.length - 1];
  const masked = "Rp ••••••";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-xs dark:border-[#1B3163] dark:bg-[#06132F]">
        <div>
          <span className="font-semibold text-slate-500 dark:text-[#C7D0E0]/70">
            Titik Fokus ({activePoint?.dateISO ?? "—"}):{" "}
          </span>
          <span
            className={`font-mono font-bold tabular-nums ${
              (activePoint?.balance ?? 0) < 0
                ? "text-rose-600 dark:text-rose-400"
                : activePoint?.isTightBuffer
                  ? "text-amber-600 dark:text-amber-300"
                  : "text-[#087BFF] dark:text-[#19D8FF]"
            }`}
          >
            {balanceHidden ? masked : formatIDR(activePoint?.balance ?? 0)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-[#C7D0E0]/75">
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

      <div className="relative overflow-hidden rounded-2xl border border-[#DCE4F0] bg-white p-3 dark:border-[#1B3163] dark:bg-[#06132F]">
        <svg
          viewBox="0 0 640 210"
          role="img"
          aria-label={`Grafik proyeksi saldo ${forecast.horizonDays} hari`}
          className="h-48 w-full select-none sm:h-56"
        >
          <defs>
            <linearGradient id="egoForecastFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#087BFF" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#19D8FF" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Horizontal reference grid */}
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
              stroke="#F43F5E"
              strokeWidth="1.2"
              strokeDasharray="4 4"
              strokeOpacity="0.7"
            />
          ) : null}

          <polygon points={areaPoints} fill="url(#egoForecastFill)" />
          <polyline
            fill="none"
            stroke="#087BFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylinePoints}
          />

          {/* Deficit warning markers */}
          {pointsMeta
            .filter((m) => m.point.isDeficit)
            .map((m) => (
              <circle
                key={`def-${m.idx}`}
                cx={m.x}
                cy={m.y}
                r="2.5"
                fill="#F43F5E"
              />
            ))}

          {/* Active marker */}
          {activeMeta ? (
            <g>
              <line
                x1={activeMeta.x}
                y1="18"
                x2={activeMeta.x}
                y2="184"
                stroke="#19D8FF"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={activeMeta.x}
                cy={activeMeta.y}
                r="5"
                fill={activeMeta.point.isDeficit ? "#F43F5E" : "#19D8FF"}
                stroke="#06132F"
                strokeWidth="2"
              />
            </g>
          ) : null}

          {/* X-axis sampled labels */}
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
                className="fill-slate-400 text-[10px] font-mono dark:fill-[#C7D0E0]/60"
              >
                {m.point.label}
              </text>
            );
          })}

          {/* Interactive hit targets */}
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
