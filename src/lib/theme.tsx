import { Moon, Sun } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

export type EgoTheme = "light" | "dark";

const THEME_STORAGE_KEY = "ego_theme";

interface ThemeContextValue {
  theme: EgoTheme;
  setTheme: (theme: EgoTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialTheme(): EgoTheme {
  if (typeof window === "undefined") return "light";
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<EgoTheme>(readInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage write errors
    }
  }, [theme]);

  function setTheme(next: EgoTheme) {
    setThemeState(next);
  }

  function toggleTheme() {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme harus dipanggil di dalam ThemeProvider.");
  }
  return ctx;
}

export function ThemeToggleButton({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Pilih tema tampilan"
      className={`inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 ${compact ? "gap-0 p-0.5" : "rounded-xl p-1"} dark:border-[#1E293B] dark:bg-[#0B111E] ${className}`}
    >
      <button
        type="button"
        aria-pressed={theme === "light"}
        onClick={() => setTheme("light")}
        className={`inline-flex ${compact ? "h-7 w-7 min-h-7 flex-none rounded-md p-0" : "min-h-[36px] flex-1 gap-1.5 rounded-lg px-2.5 py-1.5"} items-center justify-center text-xs font-semibold transition-colors whitespace-nowrap ${
          theme === "light"
            ? "bg-white text-[#101827] shadow-xs ring-1 ring-slate-200/80"
            : "text-slate-600 hover:text-[#101827] dark:text-slate-400 dark:hover:text-white"
        }`}
      >
        <Sun className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} text-[#D4AF37]`} aria-hidden="true" />
        {!compact ? <span>Terang</span> : null}
      </button>
      <button
        type="button"
        aria-pressed={theme === "dark"}
        onClick={() => setTheme("dark")}
        className={`inline-flex ${compact ? "h-7 w-7 min-h-7 flex-none rounded-md p-0" : "min-h-[36px] flex-1 gap-1.5 rounded-lg px-2.5 py-1.5"} items-center justify-center text-xs font-semibold transition-colors whitespace-nowrap ${
          theme === "dark"
            ? "bg-[#101827] text-[#E6C768] shadow-xs ring-1 ring-[#D4AF37]/40"
            : "text-slate-600 hover:text-[#101827] dark:text-slate-400 dark:hover:text-white"
        }`}
      >
        <Moon
          className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} ${
            theme === "dark" ? "text-[#E6C768]" : "text-[#101827] dark:text-[#E6C768]"
          }`}
          aria-hidden="true"
        />
        {!compact ? <span>Gelap</span> : null}
      </button>
    </div>
  );
}
