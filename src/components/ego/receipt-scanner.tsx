import { Camera, ImagePlus, Loader2, Receipt, Send, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { parseNaturalCommand } from "../../lib/command-parser";
import { useQueueCommand, useScanReceipt } from "../../lib/queries";
import type { AccountBalance } from "../../types/ego";

async function compressReceiptImage(file: File): Promise<{
  dataUrl: string;
  base64: string;
  mimeType: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file gambar struk."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () =>
        reject(new Error("Format gambar tidak didukung oleh peramban."));
      img.onload = () => {
        const maxEdge = 1400;
        let { width, height } = img;
        if (width > maxEdge || height > maxEdge) {
          if (width >= height) {
            height = Math.round((height * maxEdge) / width);
            width = maxEdge;
          } else {
            width = Math.round((width * maxEdge) / height);
            height = maxEdge;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Kanvas kompresi gambar tidak tersedia."));
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        const base64 = dataUrl.split(",")[1] ?? "";
        resolve({ dataUrl, base64, mimeType: "image/jpeg" });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ReceiptScanner({ accounts }: { accounts: AccountBalance[] }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scanReceipt = useScanReceipt();
  const queueCommand = useQueueCommand();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualFallbackText, setManualFallbackText] = useState("");
  const [showManualFallback, setShowManualFallback] = useState(false);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);

    try {
      const compressed = await compressReceiptImage(file);
      setPreviewUrl(compressed.dataUrl);
      setImageBase64(compressed.base64);
      setMimeType(compressed.mimeType);
      setFileName(file.name);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Gagal memproses foto struk."
      );
    } finally {
      e.target.value = "";
    }
  }

  function handleClear() {
    setPreviewUrl(null);
    setImageBase64(null);
    setFileName(null);
    setErrorMsg(null);
    setManualFallbackText("");
    setShowManualFallback(false);
  }

  async function handleAnalyzeAndQueue() {
    if (!imageBase64) return;
    setErrorMsg(null);

    try {
      const scanned = await scanReceipt.mutateAsync({
        imageBase64,
        mimeType,
        accounts,
      });

      await queueCommand.mutateAsync({
        command_text: scanned.commandText,
        parsed_draft: scanned.draft,
      });

      toast.success(
        `Struk "${scanned.merchant}" masuk ke Antrean Persetujuan. Tinjau dan setujui sebelum saldo berubah.`
      );
      handleClear();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Gagal menganalisis struk melalui Gemini AI.";
      setErrorMsg(message);
      setShowManualFallback(true);
      toast.error(message);
    }
  }

  async function handleQueueManualFromPhoto(e: React.FormEvent) {
    e.preventDefault();
    const clean = manualFallbackText.trim();
    if (!clean) {
      toast.error("Tulis ringkasan transaksi dari foto struk terlebih dahulu.");
      return;
    }
    try {
      const draft = parseNaturalCommand(clean, accounts);
      await queueCommand.mutateAsync({
        command_text: `[Manual dari Foto Struk] ${clean}`,
        parsed_draft: draft,
      });
      toast.success(
        "Catatan dari foto struk masuk ke Antrean Persetujuan (mode parser lokal)."
      );
      handleClear();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memasukkan draf manual."
      );
    }
  }

  const busy = scanReceipt.isPending || queueCommand.isPending;

  return (
    <section className="rounded-2xl border border-[#DCE4F0] bg-white p-6 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
            <Receipt className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#06132F] dark:text-white">
              Scan Struk / Nota Otomatis (Foto → Antrean Persetujuan)
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-[#C7D0E0]/75">
              Unggah foto struk belanja, nota restoran, atau bukti transfer. Gemini AI mengekstrak nominal, tanggal, merchant, dan kategori ke Antrean Persetujuan tanpa mengubah saldo otomatis.
            </p>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="sr-only"
        id="receipt-upload-input"
        aria-label="Pilih atau ambil foto struk transaksi"
      />

      {!previewUrl ? (
        <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F4F7FB] px-4 py-6 text-center dark:border-[#1B3163] dark:bg-[#06132F]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#087BFF] shadow-xs dark:bg-[#091634] dark:text-[#19D8FF]">
            <Camera className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mt-2.5 text-xs font-bold text-[#06132F] dark:text-white">
            Pilih foto struk dari galeri atau kamera ponsel
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
            Mendukung JPG, PNG, WebP · Gambar dikompres otomatis sebelum dikirim ke server
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-3.5 inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-[#DCE4F0] bg-white px-4 py-2 text-xs font-semibold text-[#06132F] transition-colors hover:bg-slate-50 dark:border-[#1B3163] dark:bg-[#091634] dark:text-white dark:hover:bg-[#0D1E45]"
          >
            <ImagePlus className="h-3.5 w-3.5 text-[#087BFF] dark:text-[#19D8FF]" aria-hidden="true" />
            <span>Ambil Foto / Pilih Struk</span>
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-[#DCE4F0] bg-[#F4F7FB] p-4 dark:border-[#1B3163] dark:bg-[#06132F] sm:flex-row sm:items-center">
          <img
            src={previewUrl}
            alt="Pratinjau foto struk"
            className="h-32 w-32 shrink-0 rounded-xl border border-[#DCE4F0] object-cover dark:border-[#1B3163]"
          />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div>
              <p className="truncate text-xs font-bold text-[#06132F] dark:text-white">
                {fileName || "Foto Struk Siap Dianalisis"}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-[#C7D0E0]/75">
                Hasil ekstraksi masuk ke Antrean Persetujuan Owner di bawah untuk Anda tinjau.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAnalyzeAndQueue}
                disabled={busy}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#087BFF] px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#0666DB] disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>
                  {scanReceipt.isPending
                    ? "Menganalisis Struk..."
                    : "Analisis Struk & Kirim ke Antrean"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#DCE4F0] bg-white px-3 py-2 text-xs font-medium text-[#06132F] hover:bg-slate-100 dark:border-[#1B3163] dark:bg-[#091634] dark:text-[#C7D0E0] dark:hover:bg-[#0D1E45]"
              >
                <span>Ganti Foto</span>
              </button>

              <button
                type="button"
                onClick={handleClear}
                disabled={busy}
                aria-label="Hapus pratinjau struk"
                className="inline-flex min-h-[40px] items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {errorMsg ? (
        <div className="mt-3 space-y-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="leading-relaxed">{errorMsg}</p>
          {showManualFallback && previewUrl ? (
            <form onSubmit={handleQueueManualFromPhoto} className="space-y-2 border-t border-amber-200/80 pt-3 dark:border-amber-500/20">
              <label
                htmlFor="manual-receipt-fallback"
                className="block text-[11px] font-semibold text-amber-900 dark:text-amber-200"
              >
                Alternatif Cepat (Parser Lokal): Ketik isi struk sambil melihat foto di atas
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="manual-receipt-fallback"
                  type="text"
                  value={manualFallbackText}
                  onChange={(e) => setManualFallbackText(e.target.value)}
                  placeholder='Contoh: "Indomaret 85rb pakai BCA"'
                  className="min-h-[42px] min-w-0 flex-1 rounded-xl border border-amber-300/90 bg-white px-3 py-2 text-xs text-[#06132F] placeholder:text-slate-400 focus:border-[#087BFF] focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white"
                />
                <button
                  type="submit"
                  disabled={queueCommand.isPending || !manualFallbackText.trim()}
                  className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#087BFF] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0666DB] disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Kirim ke Antrean</span>
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
