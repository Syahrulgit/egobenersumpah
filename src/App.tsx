import { useEffect, useState } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { EgoAnimatedMark } from "./components/ego/ego-brand";
import { router } from "./routeTree";

function EgoStartupSplash() {
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setVisible(false), 620);
    const removeTimer = window.setTimeout(() => setMounted(false), 850);
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
      className={`pointer-events-none fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#040B1C] transition-opacity duration-200 motion-reduce:transition-none ${visible ? "opacity-100" : "opacity-0"}`}
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
