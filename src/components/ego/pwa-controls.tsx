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
        className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-[#087BFF]/30 bg-[#087BFF]/10 px-3.5 py-2 text-xs font-semibold text-[#087BFF] transition-colors hover:bg-[#087BFF]/15 whitespace-nowrap dark:border-[#19D8FF]/35 dark:bg-[#087BFF]/20 dark:text-[#19D8FF] dark:hover:bg-[#087BFF]/30 ${
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
          className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2 text-xs font-medium text-[#06132F] transition-colors hover:bg-slate-200/70 whitespace-nowrap dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0] dark:hover:bg-[#0D1E45] ${
            fullWidth ? "w-full" : ""
          } ${className}`}
        >
          <Smartphone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Pasang di iPhone / iPad</span>
        </button>

        {showIOSGuide ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-pwa-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#06132F]/60 p-4 backdrop-blur-xs dark:bg-black/75"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-[#DCE4F0] bg-white p-6 shadow-xl dark:border-[#1B3163] dark:bg-[#091634]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#087BFF]/20 dark:text-[#19D8FF]">
                    <Smartphone className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <h3
                    id="ios-pwa-title"
                    className="text-base font-semibold text-[#06132F] dark:text-white"
                  >
                    Pasang di Layar Utama iOS
                  </h3>
                </div>
                <button
                  type="button"
                  aria-label="Tutup panduan instalasi"
                  onClick={() => setShowIOSGuide(false)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-[#C7D0E0] dark:hover:bg-[#0D1E45]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ol className="mt-4 space-y-2.5 text-xs leading-relaxed text-slate-600 dark:text-[#C7D0E0]">
                <li>
                  1. Ketuk tombol{" "}
                  <strong className="inline-flex items-center gap-1 text-[#06132F] dark:text-white">
                    <Share className="h-3 w-3" aria-hidden="true" /> Bagikan
                    (Share)
                  </strong>{" "}
                  pada bilah bawah Safari.
                </li>
                <li>
                  2. Gulir ke bawah lalu pilih{" "}
                  <strong className="text-[#06132F] dark:text-white">
                    Tambahkan ke Layar Utama (Add to Home Screen)
                  </strong>
                  .
                </li>
                <li>
                  3. Ketuk{" "}
                  <strong className="text-[#06132F] dark:text-white">
                    Tambah
                  </strong>{" "}
                  di pojok kanan atas untuk membuka EGO Personal AI layaknya aplikasi harian.
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 min-h-[44px] w-full rounded-xl bg-[#087BFF] py-2.5 text-xs font-semibold text-white hover:bg-[#0666DB]"
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
      className="fixed bottom-20 left-4 z-50 inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-900 shadow-md dark:border-amber-500/40 dark:bg-amber-950/90 dark:text-amber-200 md:bottom-5"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>Mode Luring — Menampilkan data cache terakhir.</span>
    </div>
  );
}
