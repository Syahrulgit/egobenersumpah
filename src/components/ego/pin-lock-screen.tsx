import { useNavigate } from "@tanstack/react-router";
import { Delete, Loader2, Lock, LogOut, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { markPinSessionUnlocked } from "../../lib/pin-lock";
import { useLogoutOwner, useVerifyPin } from "../../lib/queries";
import { ThemeToggleButton } from "../../lib/theme";
import { EgoLogoMark } from "./ego-brand";

interface PinLockScreenProps {
  ownerName: string;
}

const KEYPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

export function PinLockScreen({ ownerName }: PinLockScreenProps) {
  const navigate = useNavigate();
  const verifyPin = useVerifyPin();
  const logout = useLogoutOwner();

  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const submitPin = useCallback(
    async (candidate: string) => {
      if (submittingRef.current || candidate.length !== 6) return;
      submittingRef.current = true;
      setErrorMsg(null);
      try {
        await verifyPin.mutateAsync(candidate);
        markPinSessionUnlocked();
        toast.success("Brankas dibuka dengan PIN cepat.");
      } catch (err) {
        setPin("");
        setErrorMsg(
          err instanceof Error ? err.message : "PIN 6 digit tidak sesuai."
        );
      } finally {
        submittingRef.current = false;
      }
    },
    [verifyPin]
  );

  const appendDigit = useCallback(
    (digit: string) => {
      if (submittingRef.current || verifyPin.isPending) return;
      setErrorMsg(null);
      setPin((prev) => {
        if (prev.length >= 6) return prev;
        const next = `${prev}${digit}`;
        if (next.length === 6) {
          void submitPin(next);
        }
        return next;
      });
    },
    [submitPin, verifyPin.isPending]
  );

  const handleBackspace = useCallback(() => {
    if (submittingRef.current || verifyPin.isPending) return;
    setErrorMsg(null);
    setPin((prev) => prev.slice(0, -1));
  }, [verifyPin.isPending]);

  const handleClear = useCallback(() => {
    if (submittingRef.current || verifyPin.isPending) return;
    setErrorMsg(null);
    setPin("");
  }, [verifyPin.isPending]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        appendDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Escape" || e.key === "Delete") {
        e.preventDefault();
        handleClear();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [appendDigit, handleBackspace, handleClear]);

  async function handleFallbackLogout() {
    await logout.mutateAsync();
    toast.success("Silakan masuk kembali dengan email dan kata sandi lengkap.");
    await navigate({ to: "/auth" });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F4F7FB] px-4 py-8 text-[#06132F] dark:bg-[#040B1C] dark:text-slate-100">
      <div className="mb-4 flex w-full max-w-sm justify-end">
        <ThemeToggleButton />
      </div>

      <div className="w-full max-w-sm rounded-3xl border border-[#DCE4F0] bg-white p-6 shadow-sm dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-7">
        <div className="flex items-center gap-3">
          <EgoLogoMark size="md" />
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1 text-xs font-semibold text-[#087BFF] dark:text-[#19D8FF]">
              <Lock className="h-3 w-3" aria-hidden="true" />
              <span>Kunci PIN Brankas</span>
            </p>
            <p className="truncate text-sm font-bold text-[#06132F] dark:text-white">
              EGO Personal AI
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <h1 className="text-lg font-bold tracking-tight text-[#06132F] dark:text-white">
            Masukkan PIN 6 Digit
          </h1>
          <p className="mt-1 text-xs text-slate-600 dark:text-[#C7D0E0]/80">
            Brankas <span className="font-semibold text-[#06132F] dark:text-white">{ownerName}</span> terkunci. Ketik atau sentuh 6 digit PIN untuk melanjutkan.
          </p>
        </div>

        {/* 6-digit visual dots */}
        <div
          role="status"
          aria-label={`PIN terisi ${pin.length} dari 6 digit`}
          className="mt-6 flex items-center justify-center gap-3.5"
        >
          {Array.from({ length: 6 }).map((_, idx) => {
            const filled = idx < pin.length;
            return (
              <span
                key={idx}
                className={`h-3.5 w-3.5 rounded-full border transition-all duration-150 ${
                  filled
                    ? "scale-110 border-[#087BFF] bg-[#087BFF] shadow-xs shadow-[#19D8FF]/40 dark:border-[#19D8FF] dark:bg-[#19D8FF]"
                    : "border-slate-300 bg-slate-100 dark:border-[#233E7A] dark:bg-[#06132F]"
                }`}
              />
            );
          })}
        </div>

        <div className="mt-4 min-h-10 text-center">
          {verifyPin.isPending ? (
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#087BFF] dark:text-[#19D8FF]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              <span>Memverifikasi PIN brankas...</span>
            </p>
          ) : errorMsg ? (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300"
            >
              {errorMsg}
            </p>
          ) : (
            <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-[#C7D0E0]/75">
              <ShieldCheck className="h-3.5 w-3.5 text-[#087BFF] dark:text-[#19D8FF]" aria-hidden="true" />
              <span>Terlindungi batas 5 kali percobaan gagal</span>
            </p>
          )}
        </div>

        {/* Numeric Keypad */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {KEYPAD_KEYS.map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={verifyPin.isPending}
              onClick={() => appendDigit(digit)}
              aria-label={`Angka ${digit}`}
              className="flex h-14 items-center justify-center rounded-2xl border border-[#DCE4F0] bg-[#F4F7FB] font-mono text-lg font-bold text-[#06132F] transition-colors hover:border-[#087BFF]/40 hover:bg-[#087BFF]/8 active:scale-[0.97] disabled:opacity-50 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:hover:border-[#19D8FF]/40 dark:hover:bg-[#0D1E45]"
            >
              {digit}
            </button>
          ))}

          <button
            type="button"
            disabled={verifyPin.isPending || pin.length === 0}
            onClick={handleClear}
            className="flex h-14 items-center justify-center rounded-2xl border border-[#DCE4F0] bg-[#F4F7FB] text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200/70 disabled:opacity-40 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0] dark:hover:bg-[#0D1E45]"
          >
            Hapus
          </button>

          <button
            type="button"
            disabled={verifyPin.isPending}
            onClick={() => appendDigit("0")}
            aria-label="Angka 0"
            className="flex h-14 items-center justify-center rounded-2xl border border-[#DCE4F0] bg-[#F4F7FB] font-mono text-lg font-bold text-[#06132F] transition-colors hover:border-[#087BFF]/40 hover:bg-[#087BFF]/8 active:scale-[0.97] disabled:opacity-50 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:hover:border-[#19D8FF]/40 dark:hover:bg-[#0D1E45]"
          >
            0
          </button>

          <button
            type="button"
            disabled={verifyPin.isPending || pin.length === 0}
            onClick={handleBackspace}
            aria-label="Hapus satu digit"
            className="flex h-14 items-center justify-center rounded-2xl border border-[#DCE4F0] bg-[#F4F7FB] text-slate-700 transition-colors hover:bg-slate-200/70 disabled:opacity-40 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0] dark:hover:bg-[#0D1E45]"
          >
            <Delete className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 border-t border-[#DCE4F0] pt-4 dark:border-[#1B3163]">
          <button
            type="button"
            onClick={handleFallbackLogout}
            disabled={logout.isPending}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#DCE4F0] bg-white px-4 py-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-[#F4F7FB] hover:text-[#06132F] disabled:opacity-60 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0] dark:hover:bg-[#0D1E45] dark:hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Masuk dengan Kata Sandi Lengkap</span>
          </button>
        </div>
      </div>
    </div>
  );
}
