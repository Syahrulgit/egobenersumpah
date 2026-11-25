import { Loader2, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { requestSpeechAudio } from "../../lib/queries";

interface TtsButtonProps {
  text: string;
  label?: string;
  stylePrompt?: string;
  compact?: boolean;
}

export function TtsButton({
  text,
  label = "Bacakan",
  stylePrompt,
  compact = false,
}: TtsButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "playing">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  async function handleToggle() {
    if (status === "playing") {
      audioRef.current?.pause();
      audioRef.current = null;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setStatus("idle");
      return;
    }
    if (!text.trim()) return;

    setStatus("loading");
    try {
      const dataUrl = await requestSpeechAudio(text, stylePrompt);
      const audio = new Audio(dataUrl);
      audioRef.current = audio;
      audio.onended = () => setStatus("idle");
      audio.onerror = () => {
        setStatus("idle");
        toast.error("Gagal memutar audio suara.");
      };
      await audio.play();
      setStatus("playing");
    } catch (err) {
      if (
        typeof window !== "undefined" &&
        "speechSynthesis" in window &&
        typeof SpeechSynthesisUtterance !== "undefined"
      ) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text.trim().slice(0, 2500));
          utterance.lang = "id-ID";
          utterance.rate = 1.0;
          utterance.onend = () => setStatus("idle");
          utterance.onerror = () => setStatus("idle");
          window.speechSynthesis.speak(utterance);
          setStatus("playing");
          toast.info("Suara dialihkan ke sintesis suara perangkat (alternatif hemat kuota AI).");
          return;
        } catch {
          // Fall through to error toast
        }
      }
      setStatus("idle");
      toast.error(
        err instanceof Error ? err.message : "Gagal menghasilkan audio TTS."
      );
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={status === "loading" || !text.trim()}
      aria-label={status === "playing" ? `Hentikan suara ${label}` : label}
      className={`inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-[#DCE4F0] bg-white text-xs font-medium text-[#06132F] shadow-2xs transition-colors hover:border-[#087BFF]/40 hover:bg-[#F4F7FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087BFF] disabled:opacity-50 whitespace-nowrap shrink-0 dark:border-[#1B3163] dark:bg-[#091634] dark:text-[#C7D0E0] dark:shadow-none dark:hover:border-[#19D8FF]/40 dark:hover:bg-[#0D1E45] ${
        compact ? "px-3 py-1.5" : "px-3.5 py-2"
      }`}
    >
      {status === "loading" ? (
        <Loader2
          className="h-3.5 w-3.5 animate-spin text-[#087BFF] dark:text-[#19D8FF]"
          aria-hidden="true"
        />
      ) : status === "playing" ? (
        <Square
          className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400"
          aria-hidden="true"
        />
      ) : (
        <Volume2
          className="h-3.5 w-3.5 text-[#087BFF] dark:text-[#19D8FF]"
          aria-hidden="true"
        />
      )}
      <span>
        {status === "loading"
          ? "Menyiapkan Suara..."
          : status === "playing"
            ? "Hentikan"
            : label}
      </span>
    </button>
  );
}
