import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Mic, MicOff, Radio, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { parseNaturalCommand } from "../../lib/command-parser";
import {
  egoKeys,
  getActiveBearerToken,
  useQueueCommand,
  useVaultSnapshot,
} from "../../lib/queries";

interface TranscriptEntry {
  id: string;
  speaker: "owner" | "ego" | "system";
  text: string;
}

function floatTo16BitPcmBase64(float32: Float32Array): string {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function decode24kPcmToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const samples = new Float32Array(bytes.length / 2);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = view.getInt16(i * 2, true) / 32768;
  }
  return samples;
}

export function LiveVoicePanel() {
  const qc = useQueryClient();
  const { data: vault } = useVaultSnapshot(true);
  const queueCommand = useQueueCommand();
  const [status, setStatus] = useState<"idle" | "connecting" | "active" | "local-dictating">("idle");
  const statusRef = useRef(status);
  statusRef.current = status;
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [textFollowup, setTextFollowup] = useState("");
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  function stopPlaybackQueue() {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // Ignore already stopped
      }
    }
    activeSourcesRef.current.clear();
    if (outputCtxRef.current) {
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
    }
  }

  function schedulePcmAudio(base64: string) {
    const ctx = outputCtxRef.current;
    if (!ctx) return;

    const samples = decode24kPcmToFloat32(base64);
    if (samples.length === 0) return;

    const audioBuffer = ctx.createBuffer(1, samples.length, 24000);
    audioBuffer.getChannelData(0).set(samples);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    if (nextStartTimeRef.current < now) {
      nextStartTimeRef.current = now + 0.02;
    }
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += audioBuffer.duration;

    activeSourcesRef.current.add(source);
    source.onended = () => {
      activeSourcesRef.current.delete(source);
    };
  }

  function appendTranscript(speaker: TranscriptEntry["speaker"], text: string) {
    const clean = text.trim();
    if (!clean) return;
    setTranscripts((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker && speaker !== "system") {
        return [
          ...prev.slice(0, -1),
          { ...last, text: `${last.text} ${clean}`.trim() },
        ];
      }
      return [...prev.slice(-24), { id: crypto.randomUUID(), speaker, text: clean }];
    });
  }

  function cleanupSession() {
    stopPlaybackQueue();
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void inputCtxRef.current?.close().catch(() => {});
    inputCtxRef.current = null;
    void outputCtxRef.current?.close().catch(() => {});
    outputCtxRef.current = null;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("idle");
  }

  useEffect(() => {
    return () => {
      cleanupSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startLiveSession() {
    if (status !== "idle") return;
    setErrorNotice(null);
    setStatus("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const token = await getActiveBearerToken();
      const wsUrl = `${protocol}//${window.location.host}/ws/live${
        token ? `?token=${encodeURIComponent(token)}` : ""
      }`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (event) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const channelData = event.inputBuffer.getChannelData(0);
          const base64 = floatTo16BitPcmBase64(channelData);
          ws.send(JSON.stringify({ audio: base64 }));
        };

        source.connect(processor);
        processor.connect(inputCtx.destination);
      };

      ws.onmessage = (event) => {
        let msg: {
          status?: string;
          audio?: string;
          interrupted?: boolean;
          inputTranscript?: string;
          outputTranscript?: string;
          draftCreated?: { command_text: string };
          error?: string;
        };
        try {
          msg = JSON.parse(event.data as string);
        } catch {
          return;
        }

        if (msg.status === "connected") {
          setStatus("active");
          appendTranscript(
            "system",
            "Sesi suara EGO Live aktif. Silakan ucapkan perintah transaksi atau pertanyaan."
          );
        }
        if (msg.error) {
          toast.error(msg.error);
          setErrorNotice(msg.error);
          appendTranscript("system", msg.error);
          cleanupSession();
          return;
        }
        if (msg.interrupted) {
          stopPlaybackQueue();
        }
        if (msg.audio) {
          schedulePcmAudio(msg.audio);
        }
        if (msg.inputTranscript) {
          appendTranscript("owner", msg.inputTranscript);
        }
        if (msg.outputTranscript) {
          appendTranscript("ego", msg.outputTranscript);
        }
        if (msg.draftCreated) {
          toast.success(
            `Draf suara masuk Antrean Persetujuan: "${msg.draftCreated.command_text}"`
          );
          void qc.invalidateQueries({ queryKey: egoKeys.vault });
        }
      };

      ws.onerror = () => {
        const msg = "Koneksi suara EGO Live terputus.";
        toast.error(msg);
        setErrorNotice(msg);
        cleanupSession();
      };

      ws.onclose = () => {
        if (wsRef.current === ws && statusRef.current !== "idle") {
          setErrorNotice((prev) => prev ?? "Sesi suara EGO Live berakhir atau terputus.");
          cleanupSession();
        }
      };
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Izin mikrofon atau koneksi suara gagal dibuka.";
      toast.error(msg);
      setErrorNotice(msg);
      cleanupSession();
    }
  }

  function handleSendTextPrompt(e: React.FormEvent) {
    e.preventDefault();
    const clean = textFollowup.trim();
    if (!clean || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    wsRef.current.send(JSON.stringify({ text: clean }));
    appendTranscript("owner", clean);
    setTextFollowup("");
  }

  function startLocalDictation() {
    if (status !== "idle") return;
    const win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: ((e: { error?: string }) => void) | null;
        onend: (() => void) | null;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: ((e: { error?: string }) => void) | null;
        onend: (() => void) | null;
        start: () => void;
      };
    };

    const RecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      toast.error(
        "Peramban Anda belum mendukung dikte suara lokal. Silakan ketik pada kolom Input Perintah Bahasa Alami."
      );
      return;
    }

    const recognition = new RecognitionCtor();
    recognition.lang = "id-ID";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setStatus("local-dictating");

    recognition.onresult = (event) => {
      const spoken = event.results?.[0]?.[0]?.transcript?.trim() ?? "";
      setStatus("idle");
      if (!spoken) return;
      const draft = parseNaturalCommand(spoken, vault?.accounts ?? []);
      void queueCommand
        .mutateAsync({
          command_text: `[Dikte Lokal] ${spoken}`,
          parsed_draft: draft,
        })
        .then(() => {
          toast.success(
            `Dikte "${spoken}" masuk ke Antrean Persetujuan (mode lokal).`
          );
          setErrorNotice(null);
        })
        .catch((err) => {
          toast.error(
            err instanceof Error ? err.message : "Gagal menyimpan draf dikte."
          );
        });
    };

    recognition.onerror = () => {
      setStatus("idle");
      toast.error(
        "Dikte suara lokal tidak menangkap ucapan. Anda bisa mengetik langsung di kolom Parser Lokal."
      );
    };

    recognition.onend = () => {
      setStatus((prev) => (prev === "local-dictating" ? "idle" : prev));
    };

    recognition.start();
  }

  const supportsLocalSpeech =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  return (
    <section className="rounded-2xl border border-[#DCE4F0] bg-white p-6 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
            <Mic className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#06132F] dark:text-white">
              Obrolan Suara Langsung (EGO Live)
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-[#C7D0E0]/75">
              Cukup ceritakan transaksi Anda dengan suara—EGO menyiapkan drafnya untuk Anda setujui.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {supportsLocalSpeech && status === "idle" ? (
            <button
              type="button"
              onClick={startLocalDictation}
              className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2 text-xs font-semibold text-[#06132F] transition-colors hover:bg-slate-100 whitespace-nowrap dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0] dark:hover:bg-[#0D1E45]"
            >
              <Mic className="h-3.5 w-3.5 text-[#087BFF] dark:text-[#19D8FF]" aria-hidden="true" />
              <span>Dikte Lokal</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={status === "idle" ? startLiveSession : cleanupSession}
            disabled={status === "connecting" || status === "local-dictating"}
            className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
              status === "active"
                ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25"
                : "bg-[#087BFF] text-white hover:bg-[#0666DB]"
            } disabled:opacity-60`}
          >
            {status === "connecting" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Menghubungkan...</span>
              </>
            ) : status === "local-dictating" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Mendengarkan...</span>
              </>
            ) : status === "active" ? (
              <>
                <MicOff className="h-4 w-4" aria-hidden="true" />
                <span>Akhiri Sesi Suara</span>
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" aria-hidden="true" />
                <span>Mulai Bicara</span>
              </>
            )}
          </button>
        </div>
      </div>

      {errorNotice ? (
        <div className="mt-4 space-y-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="leading-relaxed">{errorNotice}</p>
          {supportsLocalSpeech ? (
            <button
              type="button"
              onClick={startLocalDictation}
              disabled={status !== "idle"}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#06132F] hover:bg-slate-50 disabled:opacity-50 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white"
            >
              <Mic className="h-3.5 w-3.5 text-[#087BFF] dark:text-[#19D8FF]" aria-hidden="true" />
              <span>Gunakan Dikte Suara Perangkat (Lokal)</span>
            </button>
          ) : (
            <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90">
              Alternatif lokal: Anda tetap dapat mengetik perintah di kolom Input Perintah Bahasa Alami (Parser Lokal).
            </p>
          )}
        </div>
      ) : null}

      {status === "active" ? (
        <div className="mt-5 space-y-3 border-t border-[#DCE4F0] pt-4 dark:border-[#1B3163]">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#087BFF] dark:text-[#19D8FF]">
            <Radio className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Mikrofon aktif (16kHz PCM) · Respons suara langsung (24kHz)</span>
          </div>

          <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3.5 dark:border-[#1B3163] dark:bg-[#06132F]">
            {transcripts.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-[#C7D0E0]/60">
                Ucapkan misalnya: "Catat beli makan siang 45 ribu pakai GoPay."
              </p>
            ) : (
              transcripts.map((entry) => (
                <div key={entry.id} className="text-xs leading-relaxed">
                  <span
                    className={`mr-2 font-semibold ${
                      entry.speaker === "owner"
                        ? "text-[#087BFF] dark:text-[#19D8FF]"
                        : entry.speaker === "ego"
                          ? "text-[#06132F] dark:text-white"
                          : "text-slate-500 dark:text-[#C7D0E0]/60"
                    }`}
                  >
                    {entry.speaker === "owner"
                      ? "Owner:"
                      : entry.speaker === "ego"
                        ? "EGO:"
                        : "Info:"}
                  </span>
                  <span className="text-slate-700 dark:text-[#C7D0E0]">
                    {entry.text}
                  </span>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSendTextPrompt} className="flex gap-2">
            <input
              type="text"
              value={textFollowup}
              onChange={(e) => setTextFollowup(e.target.value)}
              placeholder="Atau ketik pesan lanjutan di sesi aktif..."
              aria-label="Pesan teks lanjutan untuk sesi suara"
              className="min-h-[42px] flex-1 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2 text-xs text-[#06132F] placeholder:text-slate-400 focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#19D8FF]"
            />
            <button
              type="submit"
              aria-label="Kirim pesan ke sesi suara"
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#DCE4F0] bg-white px-3.5 py-2 text-xs font-semibold text-[#06132F] hover:bg-slate-100 dark:border-[#1B3163] dark:bg-[#0D1E45] dark:text-white dark:hover:bg-[#13295B]"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Kirim</span>
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
