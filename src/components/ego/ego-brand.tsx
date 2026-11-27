import { useEffect, useId, useRef, useState } from "react";

interface EgoBrandProps {
  size?: "sm" | "md" | "lg";
  showSubtitle?: boolean;
  variant?: "auto" | "navy";
  className?: string;
}

export function EgoLogoMark({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const gradId = useId();
  const dim =
    size === "sm"
      ? "h-8 w-8 rounded-xl"
      : size === "lg"
        ? "h-12 w-12 rounded-2xl"
        : "h-9 w-9 rounded-xl";

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-[#101827] ring-1 ring-[#D4AF37]/45 shadow-xs ${dim} ${className}`}
    >
      <svg
        viewBox="0 0 64 64"
        className="h-full w-full"
        role="img"
        aria-label="Logo EGO Personal AI"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F5DE93" />
            <stop offset="52%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#A9821E" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="#101827" />
        <rect
          x="5.5"
          y="5.5"
          width="53"
          height="53"
          rx="12"
          fill="none"
          stroke="rgba(212, 175, 55, 0.22)"
          strokeWidth="1.25"
        />
        <path
          d="M17 18.5H45L41.5 24H17V18.5ZM17 29.5H38.5L35 35H17V29.5ZM17 40.5H45L41.5 46H17V40.5Z"
          fill={`url(#${gradId})`}
        />
        <polygon points="46.5,28 50.5,32 46.5,36 42.5,32" fill="#FF4DDE" fillOpacity="0.92" />
      </svg>
    </div>
  );
}

/**
 * Luxury-Futuristic Robo AI Avatar:
 * Midnight Navy precision titanium chassis, Champagne Gold chamfered crest & telemetry nodes,
 * and expressive dark-glass AI visor optics reactive to state (idle / thinking / happy / alert).
 */
export function EgoRoboAvatar({
  size = "md",
  mode = "idle",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  mode?: "idle" | "processing" | "thinking" | "happy" | "alert";
  className?: string;
}) {
  const goldId = useId();
  const chassisId = useId();
  const visorColor =
    mode === "happy"
      ? "#14B8A6"
      : mode === "alert"
        ? "#EF4444"
        : "#FF4DDE";

  const dim =
    size === "sm"
      ? "h-8 w-8"
      : size === "lg"
        ? "h-14 w-14"
        : "h-10 w-10";

  return (
    <svg
      viewBox="0 0 64 64"
      className={`${dim} ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={goldId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F5DE93" />
          <stop offset="50%" stopColor="#D4AF37" />
          <stop offset="100%" stopColor="#9A7411" />
        </linearGradient>
        <linearGradient id={chassisId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1B2840" />
          <stop offset="100%" stopColor="#0D1422" />
        </linearGradient>
      </defs>

      {/* Crown telemetry antenna node */}
      <line
        x1="32"
        y1="8"
        x2="32"
        y2="14"
        stroke={`url(#${goldId})`}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle className="ego-robo-antenna" cx="32" cy="7" r="2.6" fill={visorColor} />

      {/* Twin Champagne Gold side acoustic fins */}
      <rect x="7" y="26" width="5" height="14" rx="2.5" fill={`url(#${goldId})`} />
      <rect x="52" y="26" width="5" height="14" rx="2.5" fill={`url(#${goldId})`} />

      {/* Precision Midnight Navy Robo AI head chassis */}
      <rect
        x="12"
        y="14"
        width="40"
        height="36"
        rx="13"
        fill={`url(#${chassisId})`}
        stroke={`url(#${goldId})`}
        strokeWidth="2"
      />

      {/* Inner luxury hairline bevel */}
      <rect
        x="15.5"
        y="17.5"
        width="33"
        height="29"
        rx="10"
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1"
      />

      {/* Dark glass AI visor */}
      <rect
        x="17"
        y="22"
        width="30"
        height="16"
        rx="7.5"
        fill="#070B14"
        stroke="rgba(212, 175, 55, 0.35)"
        strokeWidth="1"
      />

      {/* Expressive AI Visor Optics */}
      {mode === "happy" ? (
        <>
          <path
            d="M22 30.5 Q25.5 26.5 29 30.5"
            fill="none"
            stroke="#14B8A6"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M35 30.5 Q38.5 26.5 42 30.5"
            fill="none"
            stroke="#14B8A6"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </>
      ) : mode === "alert" ? (
        <>
          <path
            d="M22.5 27.5 L28 32.5 M28 27.5 L22.5 32.5"
            stroke="#EF4444"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M36 27.5 L41.5 32.5 M41.5 27.5 L36 32.5"
            stroke="#EF4444"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </>
      ) : mode === "thinking" || mode === "processing" ? (
        <>
          <rect x="21" y="28" width="7" height="4" rx="2" fill="#FF4DDE" />
          <rect x="30" y="27" width="4" height="6" rx="2" fill="#E6C768" />
          <rect x="36" y="28" width="7" height="4" rx="2" fill="#FF4DDE" />
        </>
      ) : (
        <g className="ego-robo-eyes">
          <rect x="22" y="26.5" width="5.5" height="7" rx="2.75" fill="#FF4DDE" />
          <rect x="36.5" y="26.5" width="5.5" height="7" rx="2.75" fill="#FF4DDE" />
          <circle cx="24" cy="28.3" r="1" fill="#FFFFFF" fillOpacity="0.85" />
          <circle cx="38.5" cy="28.3" r="1" fill="#FFFFFF" fillOpacity="0.85" />
        </g>
      )}

      {/* Subtle gold neural voice bar */}
      <rect
        className="ego-robo-voice"
        x="25"
        y="42.5"
        width="14"
        height="2.2"
        rx="1.1"
        fill={`url(#${goldId})`}
        fillOpacity="0.75"
      />
    </svg>
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
      ? "border-[#14B8A6]/55 shadow-sm shadow-[#14B8A6]/15"
      : mode === "warning"
        ? "border-[#EF4444]/55 shadow-sm shadow-[#EF4444]/15"
        : mode === "active" || mode === "processing"
          ? "border-[#FF4DDE]/45 shadow-sm shadow-[#FF4DDE]/15"
          : "border-[#D4AF37]/40 shadow-sm shadow-[#D4AF37]/10";

  const ringTone =
    mode === "success"
      ? "border-[#14B8A6]/30"
      : mode === "warning"
        ? "border-[#EF4444]/30"
        : mode === "active" || mode === "processing"
          ? "border-[#FF4DDE]/30"
          : "border-[#D4AF37]/25";

  const frameMotion =
    mode === "processing"
      ? ""
      : mode === "locked"
        ? "motion-safe:animate-[ego-appear_400ms_ease-out_1]"
        : mode === "active"
          ? "motion-safe:animate-[ego-pop_360ms_ease-out_1]"
          : mode === "success" || mode === "warning"
            ? "motion-safe:animate-[ego-pop_360ms_ease-out_1]"
            : "motion-safe:animate-[ego-breathe_4.2s_ease-in-out_infinite]";

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-[1.1rem] border bg-[#101827] p-1 ${tone} ${frameMotion} motion-reduce:animate-none ${className}`}
      aria-hidden="true"
    >
      <span
        className={`absolute inset-[-3px] rounded-[1.25rem] border ${ringTone} ${mode === "processing" ? "motion-safe:animate-[spin_2.6s_linear_infinite]" : ""} motion-reduce:animate-none`}
      />
      <EgoLogoMark size={size} className="relative z-[1]" />
    </span>
  );
}

export function EgoCompanion({
  size = "md",
  mode = "idle",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  mode?: "idle" | "processing" | "thinking" | "happy" | "alert";
  className?: string;
}) {
  const hostRef = useRef<HTMLSpanElement | null>(null);
  const [inView, setInView] = useState(true);
  const [docVisible, setDocVisible] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState === "visible"
  );

  useEffect(() => {
    const onVisChange = () => {
      setDocVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", onVisChange);
    return () => document.removeEventListener("visibilitychange", onVisChange);
  }, []);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setInView(entry.isIntersecting);
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const expressionLabel = {
    idle: "EGO Robo AI siap membantu",
    processing: "EGO Robo AI sedang memproses perintah",
    thinking: "EGO Robo AI sedang menganalisis",
    happy: "EGO Robo AI menyelesaikan tugas",
    alert: "EGO Robo AI mendeteksi kondisi yang perlu diperhatikan",
  }[mode];

  return (
    <span
      ref={hostRef}
      data-paused={!inView || !docVisible ? "true" : "false"}
      data-robo-mode={mode}
      className={`ego-companion ego-companion--${size} ego-companion--${mode} ${className}`}
      role="img"
      aria-label={expressionLabel}
    >
      <span className="ego-companion__orbit" aria-hidden="true" />
      <span className="ego-companion__orbit ego-companion__orbit--inner" aria-hidden="true" />
      <span className="ego-companion__core">
        <EgoRoboAvatar size={size} mode={mode} />
      </span>
      <span className="ego-companion__spark" aria-hidden="true" />
    </span>
  );
}

export function EgoBrand({
  size = "md",
  showSubtitle = false,
  variant = "auto",
  className = "",
}: EgoBrandProps) {
  const titleColor =
    variant === "navy"
      ? "text-white"
      : "text-[#101827] dark:text-white";
  const aiAccentColor =
    variant === "navy"
      ? "text-[#D4AF37]"
      : "text-[#B8901F] dark:text-[#D4AF37]";
  const subtitleColor =
    variant === "navy"
      ? "text-slate-300/75"
      : "text-slate-500 dark:text-slate-300/75";

  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <EgoAnimatedMark size={size} mode="idle" />
      <div className="min-w-0">
        <span className={`block truncate text-base font-bold tracking-tight ${titleColor}`}>
          EGO <span className={`font-semibold ${aiAccentColor}`}>Personal AI</span>
        </span>
        {showSubtitle ? (
          <span className={`block truncate text-[11px] font-medium ${subtitleColor}`}>
            Wealth &amp; Brankas Single-Owner
          </span>
        ) : null}
      </div>
    </div>
  );
}
