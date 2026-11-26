import { useEffect, useState } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { EgoAnimatedMark } from "./components/ego/ego-brand";
import { router } from "./routeTree";

const SPLASH_SESSION_KEY = "ego_startup_splash_shown";

function EgoStartupSplash() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let alreadyShown = false;
    try {
      alreadyShown = window.sessionStorage.getItem(SPLASH_SESSION_KEY) === "1";
    } catch {
      // If session storage is unavailable, keep the splash limited to this mount.
    }

    if (prefersReducedMotion || alreadyShown) return;

    try {
      window.sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
    } catch {
      // The splash still works when session storage is unavailable.
    }

    setMounted(true);
    setVisible(true);

    const fadeTimer = window.setTimeout(() => setVisible(false), 220);
    const removeTimer = window.setTimeout(() => setMounted(false), 370);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      role="status"
      aria-label="EGO Personal AI sedang dimulai"
      className={`pointer-events-none fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#040B1C] transition-opacity duration-150 motion-reduce:transition-none ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <div className="relative flex items-center justify-center">
        <div className="ego-splash-glow absolute h-28 w-28 rounded-full bg-[#19D8FF]/15 blur-2xl motion-safe:animate-[ego-splash-glow_1.8s_ease-in-out_infinite]" />
        <EgoAnimatedMark size="lg" mode="processing" className="scale-150" />
      </div>
      <p className="mt-7 text-sm font-bold tracking-[0.22em] text-white">
        EGO PERSONAL AI
      </p>
      <p className="mt-2 text-[10px] font-medium tracking-[0.16em] text-[#19D8FF]/75">
        PERSONAL FINANCE COMMAND CENTER
      </p>
    </div>
  );
}

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <EgoStartupSplash />
    </>
  );
}
