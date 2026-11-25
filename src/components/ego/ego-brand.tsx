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

export function EgoBrand({
  size = "md",
  showSubtitle = false,
  className = "",
}: EgoBrandProps) {
  return (
    <div className={`flex items-center gap-3 min-w-0 ${className}`}>
      <EgoLogoMark size={size} />
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
