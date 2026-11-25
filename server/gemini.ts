import {
  FunctionDeclaration,
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  Type,
} from "@google/genai";
import type { WebSocket } from "ws";
import { findBestAccountMatch, parseNaturalCommand } from "../src/lib/command-parser";
import { todayISO } from "../src/lib/finance";
import type {
  Account,
  AiAdvisorResponse,
  OwnerCommand,
  ParsedCommandDraft,
  SearchSource,
} from "../src/types/ego";
import { createAuthedSupabaseClient, verifyOwnerToken } from "./authVerify";
import { isPlaceholderEnvValue } from "./loadEnv";
import { loadVault, saveVault } from "./vaultStore";

export type GeminiErrorCode = "QUOTA_EXCEEDED" | "AUTH_ERROR" | "MODEL_NOT_FOUND" | "AI_ERROR";

export class GeminiApiError extends Error {
  statusCode: number;
  code: GeminiErrorCode;

  constructor(message: string, statusCode = 500, code: GeminiErrorCode = "AI_ERROR") {
    super(message);
    this.name = "GeminiApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function classifyGeminiError(err: unknown): GeminiApiError {
  if (err instanceof GeminiApiError) return err;

  const rawMsg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : JSON.stringify(err ?? "");

  const numericStatus =
    typeof err === "object" && err !== null && "status" in err
      ? Number((err as { status?: unknown }).status)
      : NaN;

  const lower = rawMsg.toLowerCase();

  if (
    numericStatus === 429 ||
    lower.includes("resource_exhausted") ||
    lower.includes("exceeded your current quota") ||
    lower.includes("\"code\":429") ||
    lower.includes("rate limit")
  ) {
    return new GeminiApiError(
      "Kuota atau batas permintaan Gemini API saat ini telah penuh. Anda tetap dapat memakai alternatif lokal di layar ini, menunggu reset kuota, atau memeriksa paket billing di Google AI Studio.",
      429,
      "QUOTA_EXCEEDED"
    );
  }

  if (
    numericStatus === 403 ||
    numericStatus === 401 ||
    lower.includes("permission_denied") ||
    lower.includes("api_key_invalid") ||
    lower.includes("api key not valid")
  ) {
    return new GeminiApiError(
      "Kunci Gemini API tidak valid atau tidak memiliki izin akses. Periksa pengaturan GEMINI_API_KEY di panel Secrets.",
      numericStatus === 400 || lower.includes("api_key_invalid") ? 400 : 403,
      "AUTH_ERROR"
    );
  }

  if (numericStatus === 404 || lower.includes("not_found")) {
    return new GeminiApiError(
      "Model Gemini yang diminta tidak tersedia untuk proyek ini.",
      404,
      "MODEL_NOT_FOUND"
    );
  }

  if (rawMsg.startsWith("{") && rawMsg.includes("\"error\"")) {
    return new GeminiApiError(
      "Layanan Gemini AI sedang mengalami gangguan sementara. Silakan coba lagi atau gunakan mode alternatif lokal.",
      502,
      "AI_ERROR"
    );
  }

  return new GeminiApiError(
    rawMsg || "Terjadi gangguan saat menghubungi layanan Gemini AI.",
    500,
    "AI_ERROR"
  );
}

export async function withGeminiRetryAndFallback<T>(
  models: string[],
  runner: (model: string) => Promise<T>,
  retryDelayMs = 850
): Promise<T> {
  let lastError: GeminiApiError | null = null;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await runner(model);
      } catch (err) {
        const classified = classifyGeminiError(err);
        lastError = classified;

        if (classified.code === "AUTH_ERROR") {
          throw classified;
        }

        const isRetryable =
          classified.code === "QUOTA_EXCEEDED" || classified.statusCode >= 500;

        if (attempt === 0 && isRetryable && retryDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          continue;
        }
        break;
      }
    }
  }

  throw lastError ?? new GeminiApiError("Gagal memproses permintaan Gemini AI.", 500, "AI_ERROR");
}

function getAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || isPlaceholderEnvValue(apiKey)) {
    throw new GeminiApiError(
      "GEMINI_API_KEY belum tersedia di environment server. Silakan periksa panel Secrets.",
      403,
      "AUTH_ERROR"
    );
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const searchCache = new Map<
  string,
  { expiresAt: number; result: { answer: string; sources: SearchSource[] } }
>();
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;

export async function runFinancialSearch(query: string): Promise<{
  answer: string;
  sources: SearchSource[];
}> {
  const cacheKey = query.trim().toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const ai = getAIClient();
  const response = await withGeminiRetryAndFallback(
    ["gemini-4-hydrogen", "gemini-3.1-flash-lite"],
    (model) =>
      ai.models.generateContent({
        model,
        contents: query,
        config: {
          systemInstruction:
            "Anda adalah EGO Personal AI, asisten riset keuangan pribadi berbahasa Indonesia formal dan ringkas. Gunakan hasil pencarian Google Search terkini untuk memberikan data akurat (kurs mata uang, harga emas Antam, suku bunga BI, inflasi, atau berita ekonomi). Sertakan tanggal/konteks waktu bila tersedia. Jangan mengarang angka.",
          tools: [{ googleSearch: {} }],
        },
      })
  );

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources: SearchSource[] = [];
  const seen = new Set<string>();

  for (const chunk of chunks) {
    const uri = chunk.web?.uri;
    const title = chunk.web?.title;
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      sources.push({
        uri,
        title: title || uri,
      });
    }
  }

  const result = {
    answer: response.text ?? "Tidak ada ringkasan yang dapat ditampilkan.",
    sources,
  };
  searchCache.set(cacheKey, {
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    result,
  });
  return result;
}

export async function runFinancialAdvisor(
  question: string,
  contextBrief: string,
  missingIndicators: string[] = []
): Promise<AiAdvisorResponse> {
  const cleanQuestion = question.trim().slice(0, 600);
  if (!cleanQuestion) {
    throw new Error("Pertanyaan konsultasi keuangan wajib diisi.");
  }
  const cleanBrief = contextBrief.trim().slice(0, 12000);
  if (!cleanBrief) {
    throw new Error("Ringkasan konteks keuangan Owner belum tersedia.");
  }

  const ai = getAIClient();
  let usedModel = "gemini-4-hydrogen";
  const response = await withGeminiRetryAndFallback(
    ["gemini-4-hydrogen", "gemini-3.1-flash-lite"],
    (model) => {
      usedModel = model;
      return ai.models.generateContent({
        model,
        contents: `PERTANYAAN OWNER:\n${cleanQuestion}\n\nKONTEKS BRANKAS OWNER (TERSTRUKTUR):\n${cleanBrief}`,
        config: {
          systemInstruction:
            "Anda adalah EGO AI Core, Penasihat Keuangan Pribadi (CFO Pribadi) untuk satu Owner tunggal dalam bahasa Indonesia formal, presisi, dan objektif. ATURAN KETAT: (1) Anda wajib memisahkan secara tegas antara Data Aktual terverifikasi, Data Estimasi proyeksi, Hasil Simulasi, dan Rekomendasi AI pada field JSON masing-masing. (2) JANGAN PERNAH mengarang, menebak, atau menginterpolasi angka yang tidak tertulis pada konteks. Jika sebuah metrik bertuliskan belum tersedia/kosong, nyatakan kekurangannya secara eksplisit pada peringatan_data. (3) Tegaskan bahwa perubahan saldo atau transaksi aktual hanya boleh terjadi setelah persetujuan eksplisit Owner.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ringkasan: {
                type: Type.STRING,
                description:
                  "Ringkasan eksekutif 1-3 kalimat menjawab langsung pertanyaan Owner secara akurat.",
              },
              data_aktual: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  "Poin-poin angka dan fakta terverifikasi dari data aktual (saldo, utang, anggaran, skor kesehatan).",
              },
              data_estimasi: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  "Poin proyeksi cashflow 30/90 hari, risiko defisit, dan asumsi estimasi variabel.",
              },
              hasil_simulasi: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  "Temuan dari simulasi strategi utang, target tabungan, atau skenario What-If yang relevan.",
              },
              rekomendasi_ai: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  "Langkah tindakan konkret dan terukur yang disarankan untuk Owner tanpa mutasi otomatis.",
              },
              peringatan_data: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  "Daftar keterbatasan atau data yang belum lengkap agar Owner memahami konteks keputusan.",
              },
            },
            required: [
              "ringkasan",
              "data_aktual",
              "data_estimasi",
              "hasil_simulasi",
              "rekomendasi_ai",
              "peringatan_data",
            ],
          },
        },
      });
    }
  );

  const rawJson = response.text?.trim();
  if (!rawJson) {
    throw new Error("EGO AI Core tidak mengembalikan analisis terstruktur.");
  }

  let parsed: Partial<AiAdvisorResponse>;
  try {
    parsed = JSON.parse(rawJson) as Partial<AiAdvisorResponse>;
  } catch {
    throw new Error("Format respons EGO AI Core tidak valid.");
  }

  const normalizeList = (arr: unknown): string[] =>
    Array.isArray(arr)
      ? arr
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter((item) => item.length > 0)
      : [];

  return {
    question: cleanQuestion,
    ringkasan:
      typeof parsed.ringkasan === "string" && parsed.ringkasan.trim()
        ? parsed.ringkasan.trim()
        : "Analisis keuangan selesai disusun berdasarkan data brankas Anda.",
    data_aktual: normalizeList(parsed.data_aktual),
    data_estimasi: normalizeList(parsed.data_estimasi),
    hasil_simulasi: normalizeList(parsed.hasil_simulasi),
    rekomendasi_ai: normalizeList(parsed.rekomendasi_ai),
    peringatan_data: Array.from(
      new Set([
        ...normalizeList(parsed.peringatan_data),
        ...missingIndicators.filter((m) => m.trim().length > 0),
      ])
    ),
    model_used: usedModel,
    generated_at: new Date().toISOString(),
  };
}

export async function scanReceiptToDraft(
  imageBase64: string,
  mimeType: string,
  accounts: Account[]
): Promise<{
  commandText: string;
  draft: ParsedCommandDraft;
  merchant: string;
}> {
  const ai = getAIClient();
  const allowedMimes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);
  const safeMime = allowedMimes.has(mimeType) ? mimeType : "image/jpeg";
  const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "").trim();
  if (!cleanBase64) {
    throw new Error("Data gambar struk tidak valid atau kosong.");
  }

  const activeAccountNames = accounts
    .filter((a) => a.is_active)
    .map((a) => `${a.account_name} (${a.account_type})`)
    .join(", ");

  const today = todayISO();

  const response = await withGeminiRetryAndFallback(
    ["gemini-4-hydrogen", "gemini-3.1-flash-lite"],
    (model) =>
      ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: safeMime,
                  data: cleanBase64,
                },
              },
              {
                text: `Analisis foto struk/nota/bukti transfer Indonesia ini dan ekstrak rincian transaksi utamanya. Tanggal hari ini adalah ${today}. Akun aktif milik Owner: ${activeAccountNames || "belum ada akun"}. Pastikan nominal menggunakan angka bulat Rupiah (tanpa pemisah ribuan), tanggal dalam format YYYY-MM-DD, dan isi warning jika ada bagian struk yang buram atau metode bayar tidak tertulis.`,
              },
            ],
          },
        ],
        config: {
          systemInstruction:
            "Anda adalah ekstraktor struk transaksi keuangan pribadi Indonesia. Keluarkan JSON terstruktur yang akurat dari foto struk belanja, nota restoran, tagihan listrik/internet, atau bukti transfer bank/QRIS. Pilih kategori yang paling tepat: Makanan & Minuman, Transportasi, Utilitas & Tagihan, Belanja, Investasi & Aset, Kesehatan, Hiburan, Utang & Cicilan, Transfer Internal, Gaji & Pendapatan, atau Pengeluaran Lainnya.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transaction_type: {
                type: Type.STRING,
                enum: ["expense", "income", "transfer"],
              },
              amount: {
                type: Type.NUMBER,
                description: "Total akhir yang dibayarkan atau diterima dalam Rupiah.",
              },
              transaction_date: {
                type: Type.STRING,
                description: "Tanggal transaksi format YYYY-MM-DD.",
              },
              category: {
                type: Type.STRING,
              },
              merchant: {
                type: Type.STRING,
                description: "Nama toko, merchant, atau pihak transaksi.",
              },
              description: {
                type: Type.STRING,
                description: "Ringkasan singkat isi transaksi dalam bahasa Indonesia.",
              },
              account_hint: {
                type: Type.STRING,
                description:
                  "Nama metode pembayaran/bank/e-wallet yang terlihat di struk (misal BCA, Mandiri, GoPay, QRIS, Tunai) atau string kosong jika tidak terlihat.",
              },
              warnings: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              "transaction_type",
              "amount",
              "transaction_date",
              "category",
              "merchant",
              "description",
              "account_hint",
              "warnings",
            ],
          },
        },
      })
  );

  const rawJson = response.text?.trim();
  if (!rawJson) {
    throw new Error("Gemini tidak mengembalikan hasil pembacaan struk.");
  }

  let parsed: {
    transaction_type: "expense" | "income" | "transfer";
    amount: number;
    transaction_date: string;
    category: string;
    merchant: string;
    description: string;
    account_hint: string;
    warnings: string[];
  };
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error("Format respons analisis struk tidak dapat dibaca.");
  }

  const txType = ["expense", "income", "transfer"].includes(parsed.transaction_type)
    ? parsed.transaction_type
    : "expense";
  const amount =
    Number.isFinite(parsed.amount) && parsed.amount > 0
      ? Math.round(parsed.amount)
      : null;
  const txDate = /^\d{4}-\d{2}-\d{2}$/.test(parsed.transaction_date ?? "")
    ? parsed.transaction_date
    : today;

  const accountHint = (parsed.account_hint ?? "").trim();
  const matchedAcc = accountHint
    ? findBestAccountMatch(accountHint, accounts)
    : null;

  const warnings: string[] = Array.isArray(parsed.warnings)
    ? parsed.warnings.filter((w) => typeof w === "string" && w.trim().length > 0)
    : [];

  let sourceAccountId: string | null = null;
  let destinationAccountId: string | null = null;

  if (txType === "expense") {
    sourceAccountId = matchedAcc?.id ?? null;
    if (!sourceAccountId) {
      warnings.push("Pilih akun sumber dana sebelum menyetujui draf struk ini.");
    }
  } else if (txType === "income") {
    destinationAccountId = matchedAcc?.id ?? null;
    if (!destinationAccountId) {
      warnings.push("Pilih akun tujuan dana sebelum menyetujui draf struk ini.");
    }
  } else {
    sourceAccountId = matchedAcc?.id ?? null;
    warnings.push("Periksa akun sumber dan tujuan transfer dari bukti ini.");
  }

  if (amount === null) {
    warnings.push("Nominal total struk belum terbaca jelas. Mohon isi manual.");
  }

  const merchant = (parsed.merchant ?? "").trim() || "Merchant Struk";
  const description = (parsed.description ?? "").trim() || `Struk ${merchant}`;
  const category = (parsed.category ?? "").trim() || "Belanja";

  const commandText = `[Scan Struk] ${merchant} · ${description}${
    amount ? ` · Rp ${amount.toLocaleString("id-ID")}` : ""
  }`;

  const draft: ParsedCommandDraft = {
    transaction_type: txType,
    amount,
    category,
    description: `${merchant} — ${description}`.slice(0, 140),
    source_account_id: sourceAccountId,
    destination_account_id: destinationAccountId,
    source_hint: txType !== "income" ? accountHint || null : null,
    destination_hint: txType !== "expense" ? accountHint || null : null,
    transaction_date: txDate,
    confidence:
      amount === null || warnings.length >= 2
        ? "low"
        : warnings.length === 1
          ? "medium"
          : "high",
    warnings,
  };

  return {
    commandText,
    draft,
    merchant,
  };
}

export async function synthesizeIndonesianTTS(
  text: string,
  style?: string
): Promise<{ audioBase64: string; mimeType: string }> {
  const ai = getAIClient();
  const cleanText = text.trim().slice(0, 2500);
  if (!cleanText) {
    throw new Error("Teks untuk dibacakan tidak boleh kosong.");
  }

  const response = await withGeminiRetryAndFallback(
    ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts"],
    (model) =>
      ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: cleanText,
                speechMetadata: {
                  style:
                    style ||
                    "Jelas, tenang, formal, ringkas, seperti asisten keuangan pribadi Indonesia profesional.",
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Kore" },
            },
          },
        },
      })
  );

  const base64Audio =
    response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("Model TTS tidak mengembalikan data audio.");
  }

  return {
    audioBase64: base64Audio,
    mimeType: "audio/wav",
  };
}

const createDraftProposalTool: FunctionDeclaration = {
  name: "buat_draf_mutasi",
  description:
    "Membuat draf mutasi transaksi keuangan ke Antrean Persetujuan Owner (status pending, belum memotong atau menambah saldo sampai Owner menyetujui di layar).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      command_text: {
        type: Type.STRING,
        description:
          "Ringkasan perintah bahasa alami transaksi, misalnya 'bayar kopi 25rb pakai gopay' atau 'terima gaji 15jt ke bca'.",
      },
    },
    required: ["command_text"],
  },
};

export async function attachLiveVoiceSession(
  clientWs: WebSocket,
  sessionToken: string | undefined
): Promise<void> {
  const verified = await verifyOwnerToken(sessionToken);
  if (!verified) {
    clientWs.send(
      JSON.stringify({
        error: "Sesi Owner tidak valid. Silakan masuk kembali terlebih dahulu.",
      })
    );
    clientWs.close();
    return;
  }
  const ownerId = verified.ownerId;

  let ai: GoogleGenAI;
  try {
    ai = getAIClient();
  } catch (err) {
    clientWs.send(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Konfigurasi Gemini belum siap.",
      })
    );
    clientWs.close();
    return;
  }

  const authedSupabase =
    verified.mode === "supabase" && sessionToken
      ? createAuthedSupabaseClient(sessionToken)
      : null;

  let initialAccounts: Account[] = [];
  if (authedSupabase) {
    const { data } = await authedSupabase
      .from("accounts")
      .select("*")
      .eq("is_active", true);
    initialAccounts = (data ?? []) as Account[];
  } else {
    initialAccounts = loadVault().accounts.filter((a) => a.is_active);
  }

  const accountList = initialAccounts
    .map((a) => `${a.account_name} (${a.account_type})`)
    .join(", ");

  let session: Awaited<ReturnType<typeof ai.live.connect>> | null = null;
  let closed = false;

  try {
    session = await ai.live.connect({
      model: "gemini-3.8-live",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [{ functionDeclarations: [createDraftProposalTool] }],
        systemInstruction: `Anda adalah EGO Personal AI, asisten keuangan pribadi untuk satu Owner tunggal berbahasa Indonesia formal dan ringkas. Akun aktif Owner saat ini: ${accountList || "belum ada akun"}. ATURAN BRANKAS MUTLAK: Anda hanya boleh membuat DRAF ke Antrean Persetujuan menggunakan alat buat_draf_mutasi; Anda TIDAK PERNAH bisa langsung memotong atau memindahkan saldo tanpa persetujuan manual Owner di layar. Selalu konfirmasi secara lisan bahwa draf telah dikirim ke Antrean Persetujuan untuk ditinjau Owner.`,
      },
      callbacks: {
        onopen: () => {
          if (!closed && clientWs.readyState === 1) {
            clientWs.send(JSON.stringify({ status: "connected" }));
          }
        },
        onmessage: (message: LiveServerMessage) => {
          if (closed || clientWs.readyState !== 1) return;

          const content = message.serverContent;
          if (content?.inputTranscription?.text) {
            clientWs.send(
              JSON.stringify({ inputTranscript: content.inputTranscription.text })
            );
          }
          if (content?.outputTranscription?.text) {
            clientWs.send(
              JSON.stringify({ outputTranscript: content.outputTranscription.text })
            );
          }
          if (content?.interrupted) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }

          for (const part of content?.modelTurn?.parts ?? []) {
            if (part.inlineData?.data) {
              clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
            }
          }

          for (const call of message.toolCall?.functionCalls ?? []) {
            if (call.name === "buat_draf_mutasi") {
              const commandText = String(
                (call.args as Record<string, unknown> | undefined)?.command_text ?? ""
              )
                .trim()
                .slice(0, 500);

              if (commandText) {
                void (async () => {
                  try {
                    let savedCmd: OwnerCommand;
                    if (authedSupabase) {
                      const { data: accRows } = await authedSupabase
                        .from("accounts")
                        .select("*");
                      const currentAccounts = (accRows ?? initialAccounts) as Account[];
                      const draft = parseNaturalCommand(commandText, currentAccounts);

                      const { data: inserted, error: insertErr } = await authedSupabase
                        .from("owner_commands")
                        .insert({
                          command_text: commandText,
                          status: "pending",
                          parsed_draft: draft,
                        })
                        .select("*")
                        .single();

                      if (insertErr || !inserted) {
                        throw new Error(
                          insertErr?.message || "Gagal menyimpan draf suara ke Supabase."
                        );
                      }
                      savedCmd = inserted as OwnerCommand;
                    } else {
                      const currentDb = loadVault();
                      const draft = parseNaturalCommand(commandText, currentDb.accounts);
                      savedCmd = {
                        id: crypto.randomUUID(),
                        owner_id: ownerId,
                        command_text: commandText,
                        status: "pending",
                        parsed_draft: draft,
                        created_at: new Date().toISOString(),
                      };
                      currentDb.owner_commands.unshift(savedCmd);
                      saveVault(currentDb);
                    }

                    if (!closed && clientWs.readyState === 1) {
                      clientWs.send(JSON.stringify({ draftCreated: savedCmd }));
                    }

                    session?.sendToolResponse({
                      functionResponses: [
                        {
                          id: call.id,
                          name: call.name,
                          response: {
                            ok: true,
                            message:
                              "Draf berhasil masuk ke Antrean Persetujuan (status pending). Saldo belum berubah sampai Owner menyetujui.",
                          },
                        },
                      ],
                    });
                  } catch (toolErr) {
                    session?.sendToolResponse({
                      functionResponses: [
                        {
                          id: call.id,
                          name: call.name,
                          response: {
                            ok: false,
                            message:
                              toolErr instanceof Error
                                ? toolErr.message
                                : "Gagal mengirim draf suara ke antrean.",
                          },
                        },
                      ],
                    });
                  }
                })();
              }
            }
          }
        },
        onerror: (err: unknown) => {
          if (!closed && clientWs.readyState === 1) {
            const classified = classifyGeminiError(err);
            clientWs.send(JSON.stringify({ error: classified.message }));
          }
        },
        onclose: () => {
          if (!closed && clientWs.readyState === 1) {
            clientWs.send(JSON.stringify({ status: "closed" }));
          }
        },
      },
    });
  } catch (err) {
    if (clientWs.readyState === 1) {
      const classified = classifyGeminiError(err);
      clientWs.send(JSON.stringify({ error: classified.message }));
      clientWs.close();
    }
    return;
  }

  clientWs.on("message", (raw) => {
    if (closed || !session) return;
    try {
      const msg = JSON.parse(raw.toString()) as { audio?: string; text?: string };
      if (msg.audio) {
        session.sendRealtimeInput({
          audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" },
        });
      }
      if (msg.text) {
        session.sendRealtimeInput({ text: msg.text });
      }
    } catch {
      // Ignore malformed websocket frame
    }
  });

  clientWs.on("close", () => {
    closed = true;
    try {
      session?.close();
    } catch {
      // Ignore close error
    }
  });
}
