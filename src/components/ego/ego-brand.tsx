import { useState } from "react";

interface EgoBrandProps {
  size?: "sm" | "md" | "lg";
  showSubtitle?: boolean;
  className?: string;
}

export function EgoLogoMark({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);

  const dim =
    size === "sm"
      ? "h-8 w-8 rounded-xl"
      : size === "lg"
        ? "h-12 w-12 rounded-2xl"
        : "h-9 w-9 rounded-xl";

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-[#06132F] ring-1 ring-[#19D8FF]/30 shadow-sm shadow-[#087BFF]/20 ${dim} ${className}`}
    >
      {!imgError ? (
        <img
          src="/icon-192.png"
          alt="Logo EGO Personal AI"
          onError={() => setImgError(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <svg
          viewBox="0 0 64 64"
          className="h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="egoFallbackSilver" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="55%" stopColor="#C7D0E0" />
              <stop offset="100%" stopColor="#087BFF" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="16" fill="#06132F" />
          <path
            d="M16 18H48L43 24H22L16 18ZM16 30H42L38 36H20L16 30ZM16 42H48L43 48H20L16 42Z"
            fill="url(#egoFallbackSilver)"
          />
        </svg>
      )}
    </div>
  );
}

export function EgoAnimatedMark({
  size = "md",
  mode = "idle",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  mode?: "idle" | "active" | "locked" | "processing" | "success" | "warning";
  className?: string;
}) {
  const tone =
    mode === "success"
      ? "border-emerald-400/45 shadow-[0_0_24px_rgba(52,211,153,0.22)]"
      : mode === "warning"
        ? "border-rose-400/45 shadow-[0_0_24px_rgba(251,113,133,0.2)]"
        : "border-[#19D8FF]/35 shadow-[0_0_24px_rgba(25,216,255,0.18)]";
  const frameMotion =
    mode === "processing"
      ? ""
      : mode === "locked"
        ? "motion-safe:animate-[ego-appear_520ms_ease-out_1]"
        : mode === "active"
          ? "motion-safe:animate-pulse"
          : mode === "success" || mode === "warning"
            ? "motion-safe:animate-[ego-pop_420ms_ease-out_1]"
            : "motion-safe:animate-[ego-breathe_3.6s_ease-in-out_infinite]";

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-[1.15rem] border bg-[#06132F]/70 p-1 ${tone} ${frameMotion} motion-reduce:animate-none ${className}`}
      aria-hidden="true"
    >
      <span
        className={`absolute inset-[-4px] rounded-[1.3rem] border border-[#19D8FF]/25 ${mode === "processing" ? "motion-safe:animate-[spin_2.4s_linear_infinite]" : ""} motion-reduce:animate-none`}
      />
      <EgoLogoMark size={size} className="relative z-[1]" />
    </span>
  );
}

export function EgoBrand({
  size = "md",
  showSubtitle = false,
  className = "",
}: EgoBrandProps) {
  return (
    <div className={`flex items-center gap-3 min-w-0 ${className}`}>
      <EgoAnimatedMark size={size} mode="idle" />
      <div className="min-w-0">
        <span className="block truncate text-base font-bold tracking-tight text-[#06132F] dark:text-white">
          EGO Personal AI
        </span>
        {showSubtitle ? (
          <span className="block truncate text-[11px] font-medium text-slate-500 dark:text-[#C7D0E0]/75">
            Wealth &amp; Brankas Single-Owner
          </span>
        ) : null}
      </div>
    </div>
  );
}
