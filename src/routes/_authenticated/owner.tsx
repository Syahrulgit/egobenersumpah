import { useSearch } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bot,
  BrainCircuit,
  Check,
  ExternalLink,
  Globe,
  Info,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../../components/ego/app-shell";
import { ApprovalCheck } from "../../components/ego/approval-check";
import { LiveVoicePanel } from "../../components/ego/live-voice-panel";
import { MoneyInput } from "../../components/ego/money-input";
import { ReceiptScanner } from "../../components/ego/receipt-scanner";
import { TtsButton } from "../../components/ego/tts-button";
import {
  buildEgoAiContextDigest,
  formatContextBriefForPrompt,
} from "../../lib/ai-context";
import { parseNaturalCommand } from "../../lib/command-parser";
import { formatDateID, formatIDR, todayISO } from "../../lib/finance";
import {
  useApproveCommand,
  useFinancialAdvisor,
  useFinancialSearch,
  useQueueCommand,
  useRejectCommand,
  useVaultSnapshot,
} from "../../lib/queries";
import type {
  AccountBalance,
  OwnerCommand,
  ParsedCommandDraft,
  TransactionType,
} from "../../types/ego";

const SAMPLE_COMMANDS = [
  "tadi bayar kopi 25rb pakai gopay",
  "terima transfer gaji 15jt ke bca",
  "beli emas 1 gram 1.4jt dari tabungan mandiri",
];

const ADVISOR_SUGGESTIONS = [
  "Bagaimana kondisi keuangan saya sekarang?",
  "Apakah saya mampu membeli barang Rp 10 juta?",
  "Strategi terbaik lunasi utang saya?",
  "Berapa proyeksi saldo 30 hari ke depan?",
  "Kategori apa yang paling membebani anggaran?",
  "Apa langkah tercepat menaikkan Health Score?",
];

function PendingDraftCard({
  cmd,
  accounts,
  dateFormat,
  onApprove,
  onReject,
  busy,
}: {
  cmd: OwnerCommand;
  accounts: AccountBalance[];
  dateFormat: "DD/MM/YYYY" | "YYYY-MM-DD" | "DD MMM YYYY";
  onApprove: (id: string, draft: ParsedCommandDraft) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  busy: boolean;
}) {
  const activeAccounts = accounts.filter((a) => a.is_active);
  const initialDraft: ParsedCommandDraft =
    cmd.parsed_draft ?? parseNaturalCommand(cmd.command_text, accounts);

  const [draft, setDraft] = useState<ParsedCommandDraft>(initialDraft);
  const [confirmed, setConfirmed] = useState(false);

  const typeLabel =
    draft.transaction_type === "income"
      ? "Pemasukan"
      : draft.transaction_type === "transfer"
        ? "Transfer"
        : "Pengeluaran";

  const speechPreview = `Usulan draf ${typeLabel} sebesar ${
    draft.amount ? formatIDR(draft.amount) : "nominal belum diisi"
  }, kategori ${draft.category}, keterangan ${draft.description}.`;

  return (
    <div className="space-y-4 py-5 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#087BFF]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
              Usulan Draf
            </span>
            <span className="text-xs text-slate-500 dark:text-[#C7D0E0]/75">
              {formatDateID(cmd.created_at, dateFormat)} · Keyakinan{" "}
              {draft.confidence === "high"
                ? "Tinggi"
                : draft.confidence === "medium"
                  ? "Sedang"
                  : "Rendah"}
            </span>
          </div>
          <p className="mt-1.5 text-sm font-semibold text-[#06132F] dark:text-white">
            &ldquo;{cmd.command_text}&rdquo;
          </p>
        </div>
        <TtsButton text={speechPreview} label="Bacakan Draf" compact />
      </div>

      {draft.warnings.length > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          {draft.warnings.join(" ")}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <label
            htmlFor={`draft-type-${cmd.id}`}
            className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
          >
            Jenis Mutasi
          </label>
          <select
            id={`draft-type-${cmd.id}`}
            value={draft.transaction_type}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                transaction_type: e.target.value as TransactionType,
              }))
            }
            className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
          >
            <option value="expense">Pengeluaran</option>
            <option value="income">Pemasukan</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>

        <MoneyInput
          id={`draft-amount-${cmd.id}`}
          label="Nominal (IDR)"
          value={draft.amount ?? 0}
          onChange={(val) =>
            setDraft((prev) => ({
              ...prev,
              amount: val > 0 ? val : null,
            }))
          }
          required
        />

        {draft.transaction_type !== "income" ? (
          <div className="space-y-1.5">
            <label
              htmlFor={`draft-src-${cmd.id}`}
              className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
            >
              Akun Sumber
            </label>
            <select
              id={`draft-src-${cmd.id}`}
              value={draft.source_account_id ?? ""}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  source_account_id: e.target.value || null,
                }))
              }
              className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
            >
              <option value="">Pilih sumber...</option>
              {activeAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.account_name} ({formatIDR(acc.current_balance)})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {draft.transaction_type !== "expense" ? (
          <div className="space-y-1.5">
            <label
              htmlFor={`draft-dst-${cmd.id}`}
              className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
            >
              Akun Tujuan
            </label>
            <select
              id={`draft-dst-${cmd.id}`}
              value={draft.destination_account_id ?? ""}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  destination_account_id: e.target.value || null,
                }))
              }
              className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
            >
              <option value="">Pilih tujuan...</option>
              {activeAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.account_name} ({formatIDR(acc.current_balance)})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label
            htmlFor={`draft-cat-${cmd.id}`}
            className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
          >
            Kategori
          </label>
          <input
            id={`draft-cat-${cmd.id}`}
            type="text"
            value={draft.category}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, category: e.target.value }))
            }
            className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
          />
        </div>
      </div>

      <ApprovalCheck
        id={`approve-check-${cmd.id}`}
        checked={confirmed}
        onChange={setConfirmed}
        disabled={busy}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onReject(cmd.id)}
          disabled={busy}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0] dark:hover:border-rose-500/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Tolak</span>
        </button>

        <button
          type="button"
          onClick={() => onApprove(cmd.id, draft)}
          disabled={!confirmed || busy}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-[#087BFF]/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:from-[#102452] dark:disabled:to-[#102452] dark:disabled:text-[#C7D0E0]/45"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Setujui</span>
        </button>
      </div>
    </div>
  );
}

export function OwnerControlPage() {
  const search = useSearch({ from: "/_authenticated/owner" });
  const { data: vault } = useVaultSnapshot(true);
  const queueCommand = useQueueCommand();
  const approveCommand = useApproveCommand();
  const rejectCommand = useRejectCommand();
  const searchMutation = useFinancialSearch();
  const advisorMutation = useFinancialAdvisor();

  const [viewMode, setViewMode] = useState<"all" | "ai" | "control">(
    search.tab ?? "all"
  );
  const [commandText, setCommandText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [advisorQuestion, setAdvisorQuestion] = useState("");

  useEffect(() => {
    if (search.tab === "ai" || search.tab === "control") {
      setViewMode(search.tab);
    } else {
      setViewMode("all");
    }
  }, [search.tab]);

  const accounts = vault?.accounts ?? [];
  const commands = vault?.owner_commands ?? [];
  const dateFormat = vault?.preferences.date_format ?? "DD MMM YYYY";

  const contextDigest = useMemo(
    () =>
      buildEgoAiContextDigest({
        accounts,
        transactions: vault?.transactions ?? [],
        assets: vault?.assets ?? [],
        debts: vault?.debts ?? [],
        recurringBills: vault?.recurring_bills ?? [],
        financialReminders: vault?.financial_reminders ?? [],
        savingsGoals: vault?.savings_goals ?? [],
        categoryBudgets: vault?.category_budgets ?? [],
        budgetAlertLogs: vault?.budget_alert_logs ?? [],
        whatIfScenarios: vault?.whatif_scenarios ?? [],
        referenceDateISO: todayISO(),
      }),
    [accounts, vault]
  );

  const liveDraftPreview = useMemo(() => {
    if (!commandText.trim()) return null;
    return parseNaturalCommand(commandText, accounts);
  }, [commandText, accounts]);

  const pendingCommands = commands.filter((c) => c.status === "pending");
  const historyCommands = commands.filter((c) => c.status !== "pending");

  async function handleQueueCommand(e: React.FormEvent) {
    e.preventDefault();
    const clean = commandText.trim();
    if (!clean) {
      toast.error("Masukkan perintah bahasa alami terlebih dahulu.");
      return;
    }

    try {
      const draft = parseNaturalCommand(clean, accounts);
      await queueCommand.mutateAsync({
        command_text: clean,
        parsed_draft: draft,
      });
      toast.success(
        "Draf masuk ke Antrean Persetujuan. Saldo belum berubah sebelum Anda menyetujui."
      );
      setCommandText("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memproses perintah."
      );
    }
  }

  async function handleApprove(id: string, draft: ParsedCommandDraft) {
    try {
      await approveCommand.mutateAsync({
        id,
        draft,
        owner_confirmed: true,
      });
      toast.success("Perintah disetujui dan transaksi resmi diposting.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyetujui draf."
      );
    }
  }

  async function handleReject(id: string) {
    try {
      await rejectCommand.mutateAsync(id);
      toast.success("Draf perintah ditolak tanpa mengubah saldo.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menolak draf.");
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const clean = searchQuery.trim();
    if (!clean) return;
    try {
      await searchMutation.mutateAsync(clean);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mencari informasi terkini."
      );
    }
  }

  async function submitAdvisorQuestion(rawQuestion: string) {
    const clean = rawQuestion.trim();
    if (!clean) {
      toast.error("Tulis pertanyaan keuangan untuk EGO AI Core terlebih dahulu.");
      return;
    }
    setAdvisorQuestion(clean);
    try {
      const contextBrief = formatContextBriefForPrompt(contextDigest);
      await advisorMutation.mutateAsync({
        question: clean,
        contextBrief,
        missingIndicators: contextDigest.data_belum_lengkap,
      });
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Gagal memproses konsultasi EGO AI Core."
      );
    }
  }

  async function handleAskAdvisor(e: React.FormEvent) {
    e.preventDefault();
    await submitAdvisorQuestion(advisorQuestion);
  }

  const showAiTools = viewMode === "all" || viewMode === "ai";
  const showControlQueue = viewMode === "all" || viewMode === "control";

  return (
    <AppShell
      title="Owner AI & Kendali"
      subtitle="Asisten perintah suara, pemindai struk, riset pasar, dan antrean persetujuan mutlak Owner."
      action={
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#087BFF]/30 bg-[#087BFF]/10 px-3 py-1 text-xs font-semibold text-[#087BFF] dark:border-[#19D8FF]/30 dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{pendingCommands.length} Antrean</span>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Segmented Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Pilih panel Owner AI atau Owner Control"
            className="inline-flex items-center gap-1 rounded-2xl border border-[#DCE4F0] bg-white p-1.5 dark:border-[#1B3163] dark:bg-[#091634]"
          >
            {(
              [
                { id: "all", label: "Semua" },
                { id: "ai", label: "Owner AI" },
                {
                  id: "control",
                  label: `Owner Control (${pendingCommands.length})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={viewMode === tab.id}
                onClick={() => setViewMode(tab.id)}
                className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                  viewMode === tab.id
                    ? "bg-[#087BFF] text-white shadow-xs"
                    : "text-slate-600 hover:text-[#06132F] dark:text-[#C7D0E0]/75 dark:hover:text-white"
                }`}
              >
                {tab.id === "ai" ? (
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                ) : tab.id === "control" ? (
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                ) : null}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {viewMode === "ai" && pendingCommands.length > 0 ? (
            <button
              type="button"
              onClick={() => setViewMode("control")}
              className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-300"
            >
              <span>
                {pendingCommands.length} draf menunggu persetujuan Owner
              </span>
            </button>
          ) : null}
        </div>

        {/* Owner AI Tools */}
        {showAiTools ? (
          <>
            {/* EGO AI Core — Konsultan Keuangan Cerdas */}
            <section
              aria-label="EGO AI Core Konsultan Keuangan"
              className="rounded-3xl border border-[#1B3163]/20 bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-6"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#087BFF] to-[#19D8FF] text-white shadow-sm">
                    <BrainCircuit className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#06132F] dark:text-white">
                      EGO AI Core — Konsultan Keuangan Pribadi
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-[#C7D0E0]/75">
                      Menganalisis data aktual, proyeksi arus kas, strategi utang, anggaran, dan skor kesehatan tanpa memodifikasi saldo.
                    </p>
                  </div>
                </div>
                <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#087BFF]/30 bg-[#087BFF]/10 px-3 py-1 font-mono text-[11px] font-semibold text-[#087BFF] dark:border-[#19D8FF]/30 dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
                  <span>
                    Skor:{" "}
                    {contextDigest.data_aktual.health_score !== null
                      ? `${contextDigest.data_aktual.health_score}/100`
                      : "—"}
                  </span>
                </div>
              </div>

              {/* Prompt Suggestions */}
              <div className="mt-4 flex flex-wrap gap-2">
                {ADVISOR_SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={advisorMutation.isPending}
                    onClick={() => void submitAdvisorQuestion(q)}
                    className="min-h-[34px] rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3 py-1.5 text-left text-[11px] font-medium text-slate-700 transition-colors hover:border-[#087BFF]/45 hover:text-[#087BFF] disabled:opacity-50 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]/85 dark:hover:border-[#19D8FF]/45 dark:hover:text-[#19D8FF]"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <form onSubmit={handleAskAdvisor} className="mt-4 flex flex-col gap-2 sm:flex-row">
                <label htmlFor="ego-ai-advisor-input" className="sr-only">
                  Pertanyaan untuk EGO AI Core
                </label>
                <input
                  id="ego-ai-advisor-input"
                  type="text"
                  maxLength={400}
                  value={advisorQuestion}
                  onChange={(e) => setAdvisorQuestion(e.target.value)}
                  placeholder="Tanyakan kondisi kas, kemampuan beli, strategi utang, atau evaluasi anggaran..."
                  className="min-w-0 flex-1 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-4 py-2.5 text-sm text-[#06132F] placeholder:text-slate-400 focus:border-[#087BFF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087BFF]/15 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:placeholder:text-[#C7D0E0]/45 dark:focus:border-[#19D8FF]"
                />
                <button
                  type="submit"
                  disabled={advisorMutation.isPending || !advisorQuestion.trim()}
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#087BFF]/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                >
                  {advisorMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>Analisis Sekarang</span>
                </button>
              </form>

              {advisorMutation.isError ? (
                <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-bold">Konsultasi AI Belum Dapat Diproses</p>
                    <p className="mt-0.5 leading-relaxed">
                      {advisorMutation.error instanceof Error
                        ? advisorMutation.error.message
                        : "Pastikan GEMINI_API_KEY tersedia pada server lokal/backend."}
                    </p>
                  </div>
                </div>
              ) : null}

              {advisorMutation.data ? (
                <div className="mt-5 space-y-4 rounded-2xl border border-[#DCE4F0] bg-[#F4F7FB] p-4 dark:border-[#1B3163] dark:bg-[#06132F] sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#087BFF]/12 px-2.5 py-0.5 text-[11px] font-bold text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
                        <BrainCircuit className="h-3 w-3" aria-hidden="true" />
                        <span>Ringkasan Konsultasi EGO AI Core</span>
                      </span>
                      <p className="mt-2 text-sm font-semibold leading-relaxed text-[#06132F] dark:text-white">
                        {advisorMutation.data.ringkasan}
                      </p>
                    </div>
                    <TtsButton
                      text={`${advisorMutation.data.ringkasan} Rekomendasi utama: ${advisorMutation.data.rekomendasi_ai.join(". ")}`}
                      label="Bacakan"
                      compact
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-[#DCE4F0] bg-white p-3.5 dark:border-[#1B3163] dark:bg-[#091634]">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        1. Data Aktual Terverifikasi
                      </p>
                      <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-700 dark:text-[#C7D0E0]">
                        {advisorMutation.data.data_aktual.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-[#DCE4F0] bg-white p-3.5 dark:border-[#1B3163] dark:bg-[#091634]">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#087BFF] dark:text-[#19D8FF]">
                        2. Data Estimasi &amp; Forecast
                      </p>
                      <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-700 dark:text-[#C7D0E0]">
                        {advisorMutation.data.data_estimasi.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-[#DCE4F0] bg-white p-3.5 dark:border-[#1B3163] dark:bg-[#091634]">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                        3. Hasil Simulasi Tersedia
                      </p>
                      <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-700 dark:text-[#C7D0E0]">
                        {advisorMutation.data.hasil_simulasi.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-[#087BFF]/25 bg-white p-3.5 dark:border-[#19D8FF]/25 dark:bg-[#091634]">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#06132F] dark:text-white">
                        4. Rekomendasi AI (Keputusan Tetap di Owner)
                      </p>
                      <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-700 dark:text-[#C7D0E0]">
                        {advisorMutation.data.rekomendasi_ai.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {advisorMutation.data.peringatan_data.length > 0 ? (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/75 px-3.5 py-2.5 text-[11px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <div>
                        <span className="font-bold">Catatan Kelengkapan Data: </span>
                        {advisorMutation.data.peringatan_data.join(" · ")}
                      </div>
                    </div>
                  ) : null}

                  <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/65">
                    Model: <span className="font-mono">{advisorMutation.data.model_used}</span> · Rekomendasi di atas hanya bersifat analitis dan tidak mencatat transaksi otomatis.
                  </p>
                </div>
              ) : null}
            </section>

            <div className="grid gap-6 lg:grid-cols-12">
              {/* Natural Language Input */}
              <section className="rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-6 lg:col-span-7">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
                    <Bot className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <h2 className="text-base font-bold text-[#06132F] dark:text-white">
                    Perintah Bahasa Alami (Parser Lokal)
                  </h2>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-[#C7D0E0]/75">
                  Ketik perintah keuangan dengan bahasa santai. EGO menyiapkan usulan draf ke Antrean Persetujuan tanpa memotong saldo secara otomatis.
                </p>

                <form onSubmit={handleQueueCommand} className="mt-4 space-y-3">
                  <label htmlFor="owner-cmd-input" className="sr-only">
                    Perintah bahasa alami Owner
                  </label>
                  <textarea
                    id="owner-cmd-input"
                    rows={3}
                    maxLength={500}
                    value={commandText}
                    onChange={(e) => setCommandText(e.target.value)}
                    placeholder='Contoh: "tadi bayar kopi 25rb pakai gopay" atau "terima gaji 15jt ke bca"'
                    className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] placeholder:text-slate-400 focus:border-[#087BFF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087BFF]/15 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:placeholder:text-[#C7D0E0]/45 dark:focus:border-[#19D8FF] dark:focus:ring-[#19D8FF]/20"
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    {SAMPLE_COMMANDS.map((sample) => (
                      <button
                        key={sample}
                        type="button"
                        onClick={() => setCommandText(sample)}
                        className="min-h-[34px] rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-[#087BFF]/40 hover:text-[#087BFF] dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]/80 dark:hover:border-[#19D8FF]/40 dark:hover:text-[#19D8FF]"
                      >
                        {sample}
                      </button>
                    ))}
                  </div>

                  {liveDraftPreview ? (
                    <div className="rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3.5 dark:border-[#1B3163] dark:bg-[#06132F]">
                      <p className="mb-1.5 text-[11px] font-semibold text-slate-500 dark:text-[#C7D0E0]/70">
                        Pratinjau Draf Terstruktur (JSON)
                      </p>
                      <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-[#087BFF] dark:text-[#19D8FF]">
                        {JSON.stringify(liveDraftPreview, null, 2)}
                      </pre>
                    </div>
                  ) : null}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={queueCommand.isPending || !commandText.trim()}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#087BFF]/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:from-[#102452] dark:disabled:to-[#102452] dark:disabled:text-[#C7D0E0]/45"
                    >
                      {queueCommand.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Send className="h-4 w-4" aria-hidden="true" />
                      )}
                      <span>Kirim ke Antrean Persetujuan</span>
                    </button>
                  </div>
                </form>
              </section>

              {/* Right Column: Live Voice + Google Search Grounding */}
              <div className="space-y-6 lg:col-span-5">
                <LiveVoicePanel />

                <section className="rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-6">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
                      <Globe className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <h2 className="text-base font-bold text-[#06132F] dark:text-white">
                      Riset Keuangan (Google Search)
                    </h2>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-[#C7D0E0]/75">
                    Dapatkan data kurs, harga emas, suku bunga, atau informasi ekonomi terbaru langsung dari Google Search.
                  </p>

                  <form onSubmit={handleSearch} className="mt-3 flex gap-2">
                    <input
                      type="text"
                      aria-label="Pertanyaan riset keuangan Google Search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Contoh: Harga emas Antam 1 gram hari ini"
                      className="min-w-0 flex-1 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2 text-xs text-[#06132F] placeholder:text-slate-400 focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:placeholder:text-[#C7D0E0]/45 dark:focus:border-[#19D8FF]"
                    />
                    <button
                      type="submit"
                      disabled={searchMutation.isPending || !searchQuery.trim()}
                      className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl bg-[#087BFF] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0666DB] disabled:opacity-50 whitespace-nowrap"
                    >
                      {searchMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : null}
                      <span>Cari</span>
                    </button>
                  </form>

                  {searchMutation.isError ? (
                    <div className="mt-4 space-y-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                      <p className="leading-relaxed">
                        {searchMutation.error instanceof Error
                          ? searchMutation.error.message
                          : "Gagal mengambil ringkasan AI."}
                      </p>
                      {searchQuery.trim() ? (
                        <a
                          href={`https://www.google.com/search?q=${encodeURIComponent(searchQuery.trim())}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#06132F] hover:bg-slate-50 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white"
                        >
                          <span>Cari Langsung di Google</span>
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      ) : null}
                    </div>
                  ) : searchMutation.data ? (
                    <div className="mt-4 space-y-3 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3.5 text-xs leading-relaxed text-slate-700 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#087BFF] dark:text-[#19D8FF]">
                          Ringkasan Terverifikasi Search
                        </span>
                        <TtsButton
                          text={searchMutation.data.answer}
                          label="Bacakan Jawaban"
                          compact
                        />
                      </div>
                      <p className="whitespace-pre-line text-slate-700 dark:text-[#C7D0E0]">
                        {searchMutation.data.answer}
                      </p>
                      {searchMutation.data.sources.length > 0 ? (
                        <div className="border-t border-[#DCE4F0] pt-2 dark:border-[#1B3163]">
                          <p className="mb-1 text-[11px] font-medium text-slate-500 dark:text-[#C7D0E0]/70">
                            Sumber Referensi:
                          </p>
                          <ul className="space-y-1">
                            {searchMutation.data.sources.map((src) => (
                              <li key={src.uri}>
                                <a
                                  href={src.uri}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[#087BFF] hover:underline dark:text-[#19D8FF]"
                                >
                                  <span className="max-w-64 truncate">{src.title}</span>
                                  <ExternalLink className="h-3 w-3 shrink-0" />
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              </div>
            </div>

            {/* Receipt / Nota Photo Scanner */}
            <ReceiptScanner accounts={accounts} />
          </>
        ) : null}

        {/* Owner Control Queue & History */}
        {showControlQueue ? (
          <>
            <section className="rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#06132F] dark:text-white">
                    Antrean Persetujuan Owner ({pendingCommands.length})
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-[#C7D0E0]/75">
                    Setiap draf wajib Anda tinjau dan setujui secara eksplisit sebelum saldo akun berubah.
                  </p>
                </div>
              </div>

              {pendingCommands.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#DCE4F0] bg-[#F4F7FB] p-8 text-center dark:border-[#1B3163] dark:bg-[#06132F]/60">
                  <p className="text-sm font-bold text-[#06132F] dark:text-white">
                    Antrean persetujuan bersih
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-[#C7D0E0]/75">
                    Kirim perintah teks, suara, atau pindai struk untuk menyiapkan usulan transaksi baru.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#DCE4F0]/80 dark:divide-[#1B3163]">
                  {pendingCommands.map((cmd) => (
                    <PendingDraftCard
                      key={cmd.id}
                      cmd={cmd}
                      accounts={accounts}
                      dateFormat={dateFormat}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      busy={approveCommand.isPending || rejectCommand.isPending}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Historical Owner Commands Log */}
            <section className="rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-6">
              <h2 className="text-base font-bold text-[#06132F] dark:text-white">
                Log Riwayat Perintah Owner
              </h2>
              {historyCommands.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500 dark:text-[#C7D0E0]/65">
                  Belum ada riwayat perintah yang disetujui atau ditolak.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-[#DCE4F0]/80 dark:divide-[#1B3163]">
                  {historyCommands.map((cmd) => (
                    <li
                      key={cmd.id}
                      className="flex flex-col justify-between gap-2 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#06132F] dark:text-white">
                          &ldquo;{cmd.command_text}&rdquo;
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-[#C7D0E0]/75">
                          {formatDateID(cmd.created_at, dateFormat)} ·{" "}
                          {cmd.parsed_draft?.amount
                            ? formatIDR(cmd.parsed_draft.amount)
                            : "Tanpa nominal"}{" "}
                          · {cmd.parsed_draft?.category ?? "Umum"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          cmd.status === "processed"
                            ? "bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {cmd.status === "processed"
                          ? "Disetujui & Terposting"
                          : "Ditolak"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
