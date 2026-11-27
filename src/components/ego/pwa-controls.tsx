import { Download, Share, Smartphone, WifiOff, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useOnlineStatus, usePWAInstall } from "../../lib/pwa";

export function PWAInstallButton({
  className = "",
  fullWidth = false,
}: {
  className?: string;
  fullWidth?: boolean;
}) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={async () => {
          const accepted = await install();
          if (accepted) {
            toast.success("EGO Personal AI berhasil dipasang ke perangkat.");
          }
        }}
        className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/45 bg-[#D4AF37]/12 px-3.5 py-2 text-xs font-semibold text-[#9A7411] transition-colors hover:bg-[#D4AF37]/20 whitespace-nowrap dark:border-[#D4AF37]/40 dark:bg-[#D4AF37]/15 dark:text-[#E6C768] dark:hover:bg-[#D4AF37]/25 ${
          fullWidth ? "w-full" : ""
        } ${className}`}
      >
        <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Pasang Aplikasi</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex min-w-0 min-h-[40px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-[#101827] transition-colors hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/10 whitespace-nowrap dark:border-[#1E293B] dark:bg-[#162032] dark:text-slate-200 dark:hover:border-[#D4AF37]/40 ${
            fullWidth ? "w-full" : ""
          } ${className}`}
        >
          <Smartphone className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" aria-hidden="true" />
          <span>Pasang di iPhone / iPad</span>
        </button>

        {showIOSGuide ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-pwa-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B111E]/75 p-4 backdrop-blur-xs dark:bg-black/80"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-[#D4AF37]/25 dark:bg-[#101827]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D4AF37]/15 text-[#9A7411] dark:text-[#E6C768]">
                    <Smartphone className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <h3
                    id="ios-pwa-title"
                    className="text-base font-semibold text-[#101827] dark:text-white"
                  >
                    Pasang di Layar Utama iOS
                  </h3>
                </div>
                <button
                  type="button"
                  aria-label="Tutup panduan instalasi"
                  onClick={() => setShowIOSGuide(false)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#162032]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ol className="mt-4 space-y-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                <li>
                  1. Ketuk tombol{" "}
                  <strong className="inline-flex items-center gap-1 text-[#101827] dark:text-white">
                    <Share className="h-3 w-3" aria-hidden="true" /> Bagikan
                    (Share)
                  </strong>{" "}
                  pada bilah bawah Safari.
                </li>
                <li>
                  2. Gulir ke bawah lalu pilih{" "}
                  <strong className="text-[#101827] dark:text-white">
                    Tambahkan ke Layar Utama (Add to Home Screen)
                  </strong>
                  .
                </li>
                <li>
                  3. Ketuk{" "}
                  <strong className="text-[#101827] dark:text-white">
                    Tambah
                  </strong>{" "}
                  di pojok kanan atas untuk membuka EGO Personal AI layaknya aplikasi harian.
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 min-h-[44px] w-full rounded-xl bg-gradient-to-r from-[#E6C768] to-[#D4AF37] py-2.5 text-xs font-bold text-[#101827] hover:brightness-105"
              >
                Mengerti
              </button>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return null;
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-4 z-50 inline-flex items-center gap-2 rounded-xl border border-[#D4AF37]/40 bg-[#101827] px-3.5 py-2 text-xs font-medium text-[#E6C768] shadow-md md:bottom-5"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>Mode Luring — Menampilkan data cache terakhir.</span>
    </div>
  );
}
