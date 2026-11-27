import { motion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";

export const EGO_EASE = [0.16, 1, 0.3, 1] as const;

export const EGO_ROUTE_ORDER = [
  "/",
  "/transaksi",
  "/akun",
  "/anggaran",
  "/analitik",
  "/simulasi",
  "/aset",
  "/utang",
  "/rencana",
  "/pengingat",
  "/laporan",
  "/owner",
  "/pengaturan",
] as const;

export function getRouteOrderIndex(pathname: string): number {
  if (pathname === "/") return 0;
  const idx = EGO_ROUTE_ORDER.findIndex(
    (route) => route !== "/" && pathname.startsWith(route)
  );
  return idx === -1 ? 0 : idx;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type SignatureFeedbackKind =
  | "nav"
  | "ai"
  | "action"
  | "notif"
  | "back"
  | "toggle";

/**
 * Triggers light device haptics (where supported) and a lightweight radial
 * Champagne Gold / Neon Magenta light ripple from the tapped element.
 * Respects `prefers-reduced-motion` and cleans up DOM immediately after animation.
 */
export function triggerSignatureFeedback(
  element: HTMLElement | null | undefined,
  kind: SignatureFeedbackKind = "nav",
  clientCoords?: { clientX: number; clientY: number }
): void {
  if (typeof window === "undefined") return;

  const reduced = prefersReducedMotion();

  // Optional gentle haptic pulse on supported mobile hardware
  if (!reduced && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      if (kind === "ai") {
        navigator.vibrate([6, 22, 8]);
      } else if (kind === "action" || kind === "notif") {
        navigator.vibrate(10);
      } else {
        navigator.vibrate(6);
      }
    } catch {
      // Ignore platforms that block vibrate outside strict user gestures
    }
  }

  if (reduced || !element || typeof document === "undefined") return;

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const relX =
    clientCoords && clientCoords.clientX > 0
      ? clientCoords.clientX - rect.left
      : rect.width / 2;
  const relY =
    clientCoords && clientCoords.clientY > 0
      ? clientCoords.clientY - rect.top
      : rect.height / 2;

  const ripple = document.createElement("span");
  ripple.className = `ego-signature-ripple ego-signature-ripple--${kind}`;
  const diameter = Math.max(rect.width, rect.height) * 1.15;
  ripple.style.width = `${diameter}px`;
  ripple.style.height = `${diameter}px`;
  ripple.style.left = `${relX - diameter / 2}px`;
  ripple.style.top = `${relY - diameter / 2}px`;

  element.appendChild(ripple);
  const cleanup = () => {
    ripple.remove();
  };
  ripple.addEventListener("animationend", cleanup, { once: true });
  window.setTimeout(cleanup, 420);
}

/**
 * Custom hook that tracks whether an element has entered the viewport (once)
 * and whether the document is currently visible, without blocking first paint.
 */
export function useRevealOnce<T extends HTMLElement = HTMLDivElement>(
  threshold = 0.12
) {
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(() => prefersReducedMotion());

  useEffect(() => {
    if (revealed) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold }
    );

    observer.observe(el);
    // Safety fallback so content/charts never remain hidden on unusual scroll containers
    const fallback = window.setTimeout(() => setRevealed(true), 240);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, [revealed, threshold]);

  return { ref, revealed };
}

interface EgoCountUpProps {
  value: number;
  formatter?: (val: number) => string;
  durationMs?: number;
  className?: string;
}

/**
 * Smooth, brief numerical count-up (260-360ms) when values appear or change.
 * Snaps immediately when `prefers-reduced-motion: reduce` is enabled.
 */
export function EgoCountUp({
  value,
  formatter = (v) => String(Math.round(v)),
  durationMs = 340,
  className = "",
}: EgoCountUpProps) {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const prevValueRef = useRef<number>(value);

  useEffect(() => {
    const startVal = prevValueRef.current;
    const endVal = Number.isFinite(value) ? value : 0;

    if (
      startVal === endVal ||
      prefersReducedMotion() ||
      typeof window === "undefined"
    ) {
      prevValueRef.current = endVal;
      setDisplayValue(endVal);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Fast settle ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * eased;
      setDisplayValue(current);

      if (progress < 1) {
        rafId = window.requestAnimationFrame(step);
      } else {
        prevValueRef.current = endVal;
        setDisplayValue(endVal);
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(rafId);
      prevValueRef.current = endVal;
    };
  }, [value, durationMs]);

  return <span className={className}>{formatter(displayValue)}</span>;
}

interface EgoSectionProps {
  children: ReactNode;
  index?: number;
  className?: string;
}

/**
 * Lightweight card/section entrance stagger capped at 3 groups (max +110ms delay).
 * Keeps opacity + translateY strictly on the compositor without leaving persistent transforms.
 */
export function EgoStaggerSection({
  children,
  index = 0,
  className = "",
}: EgoSectionProps) {
  const cappedDelay = Math.min(2, Math.max(0, index)) * 0.055;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.28,
        delay: cappedDelay,
        ease: EGO_EASE,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface EgoAnimatedBarProps {
  percentage: number;
  barClassName?: string;
  trackClassName?: string;
  heightClassName?: string;
  ariaLabel?: string;
}

/**
 * Compositor-friendly animated progress bar using `scaleX` from 0 to actual value.
 */
export function EgoAnimatedBar({
  percentage,
  barClassName = "bg-gradient-to-r from-[#B8901F] to-[#D4AF37]",
  trackClassName = "bg-slate-200 dark:bg-slate-800",
  heightClassName = "h-2",
  ariaLabel,
}: EgoAnimatedBarProps) {
  const clamped = Math.min(100, Math.max(0, percentage));
  const { ref, revealed } = useRevealOnce<HTMLDivElement>(0.05);

  return (
    <div
      ref={ref}
      role={ariaLabel ? "progressbar" : undefined}
      aria-label={ariaLabel}
      aria-valuenow={ariaLabel ? Math.round(clamped) : undefined}
      aria-valuemin={ariaLabel ? 0 : undefined}
      aria-valuemax={ariaLabel ? 100 : undefined}
      className={`w-full overflow-hidden rounded-full ${heightClassName} ${trackClassName}`}
    >
      <div
        className={`h-full w-full origin-left rounded-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${barClassName}`}
        style={{
          transform: `scaleX(${revealed ? clamped / 100 : 0})`,
        }}
      />
    </div>
  );
}
