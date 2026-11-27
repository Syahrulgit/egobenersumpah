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
import {
  EgoAnimatedMark,
  EgoCompanion,
} from "../../components/ego/ego-brand";
import {
  EgoCountUp,
  EgoStaggerSection,
} from "../../components/ego/ego-motion";
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
            <span className="rounded-full border border-[#FF4DDE]/25 bg-[#FF4DDE]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#A21CAF] dark:text-[#FF9EEA]">
              Usulan Draf
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {formatDateID(cmd.created_at, dateFormat)} · Keyakinan{" "}
              {draft.confidence === "high"
                ? "Tinggi"
                : draft.confidence === "medium"
                  ? "Sedang"
                  : "Rendah"}
            </span>
          </div>
          <p className="mt-1.5 text-sm font-semibold text-[#101827] dark:text-white">
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
            className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
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
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:focus:border-[#D4AF37]"
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
              className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
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
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:focus:border-[#D4AF37]"
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
              className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
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
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:focus:border-[#D4AF37]"
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
            className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
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
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:focus:border-[#D4AF37]"
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
          className="ego-pressable inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-[#EF4444]/40 hover:bg-[#EF4444]/10 hover:text-[#DC2626] dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-200 dark:hover:border-[#EF4444]/40 dark:hover:text-[#F87171]"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Tolak</span>
        </button>

        <button
          type="button"
          onClick={() => onApprove(cmd.id, draft)}
          disabled={!confirmed || busy}
          className="ego-pressable inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2 text-xs font-semibold text-[#101827] shadow-sm shadow-[#D4AF37]/20 transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:from-[#162032] dark:disabled:to-[#162032] dark:disabled:text-slate-500"
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
  const processedCount = historyCommands.filter(
    (c) => c.status === "processed"
  ).length;
  const rejectedCount = historyCommands.filter(
    (c) => c.status === "rejected"
  ).length;

  const roboMode =
    advisorMutation.isPending || searchMutation.isPending
      ? "thinking"
      : queueCommand.isPending ||
          approveCommand.isPending ||
          rejectCommand.isPending
        ? "processing"
        : advisorMutation.isError ||
            searchMutation.isError ||
            queueCommand.isError ||
            approveCommand.isError
          ? "alert"
          : advisorMutation.data || approveCommand.isSuccess
            ? "happy"
            : "idle";

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
      toast.success("Perintah disetujui dan transaksi resmi diposting.", {
        icon: <EgoAnimatedMark size="sm" mode="success" />,
      });
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
      subtitle="Asisten Robo AI, perintah suara, pemindai struk, riset pasar, dan antrean persetujuan mutlak Owner."
      action={
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#FF4DDE]/30 bg-[#FF4DDE]/10 px-3 py-1 text-xs font-semibold text-[#A21CAF] dark:text-[#FF9EEA]">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{pendingCommands.length} Antrean</span>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Segmented Filter + Owner Control Summary */}
        <EgoStaggerSection index={0} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Pilih panel Owner AI atau Owner Control"
            className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-[#1E293B] dark:bg-[#101827]"
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
                className={`ego-pressable inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === tab.id
                    ? "bg-[#101827] text-white shadow-xs dark:bg-[#D4AF37] dark:text-[#101827]"
                    : "text-slate-600 hover:text-[#101827] dark:text-slate-400 dark:hover:text-white"
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
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-[#FF4DDE]/25 bg-white px-4 py-3 dark:bg-[#101827]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A21CAF] dark:text-[#FF9EEA]">
              Menunggu Persetujuan
            </p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-[#101827] dark:text-white">
              <EgoCountUp
                value={pendingCommands.length}
                formatter={(v) => `${Math.round(v)}`}
              />
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-[#1E293B] dark:bg-[#101827]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Disetujui Owner
            </p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-[#0D9488] dark:text-[#2DD4BF]">
              <EgoCountUp
                value={processedCount}
                formatter={(v) => `${Math.round(v)}`}
              />
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-[#1E293B] dark:bg-[#101827]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Ditolak
            </p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-[#DC2626] dark:text-[#F87171]">
              <EgoCountUp
                value={rejectedCount}
                formatter={(v) => `${Math.round(v)}`}
              />
            </p>
          </div>
        </div>
        </EgoStaggerSection>

        {/* Owner AI Tools */}
        {showAiTools ? (
          <EgoStaggerSection index={1} className="space-y-6">
            {/* EGO AI Core + Robo AI Interactive Console */}
            <section
              aria-label="EGO AI Core Konsultan Keuangan"
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none sm:p-6"
            >
              {/* Midnight Navy + Neon Magenta Robo AI Console Strip */}
              <div className="ego-card-hero ego-card-hero--living rounded-2xl border border-[#FF4DDE]/30 p-4 text-white sm:p-5">
                <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="shrink-0">
                      <EgoCompanion size="lg" mode={roboMode} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF4DDE]/40 bg-[#FF4DDE]/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#FF9EEA]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#FF4DDE]" />
                          Robo AI Core Aktif
                        </span>
                        <EgoAnimatedMark
                          size="sm"
                          mode={
                            advisorMutation.isPending
                              ? "processing"
                              : advisorMutation.data
                                ? "success"
                                : "active"
                          }
                        />
                      </div>
                      <h2 className="mt-1.5 text-base font-bold text-white sm:text-lg">
                        EGO AI Core — Konsultan Keuangan Pribadi
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-300">
                        Menganalisis data aktual, proyeksi arus kas, strategi utang, anggaran, dan skor kesehatan tanpa memodifikasi saldo.
                      </p>
                    </div>
                  </div>
                  <div className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-3.5 py-1.5 font-mono text-xs font-semibold text-[#E6C768] sm:self-center">
                    <span>
                      Skor:{" "}
                      {contextDigest.data_aktual.health_score !== null
                        ? `${contextDigest.data_aktual.health_score}/100`
                        : "—"}
                    </span>
                  </div>
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
                    className="ego-pressable min-h-[36px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-[11px] font-medium text-slate-700 transition-colors hover:border-[#FF4DDE]/45 hover:text-[#A21CAF] disabled:opacity-50 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-300 dark:hover:border-[#FF4DDE]/45 dark:hover:text-[#FF9EEA]"
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
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-[#101827] placeholder:text-slate-400 focus:border-[#FF4DDE]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FF4DDE]/15 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={advisorMutation.isPending || !advisorQuestion.trim()}
                  className="ego-pressable inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-5 py-2.5 text-sm font-semibold text-[#101827] shadow-sm shadow-[#D4AF37]/20 transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
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
                <div className="mt-5 space-y-4 rounded-2xl border border-[#FF4DDE]/25 bg-slate-50 p-4 dark:bg-[#0B111E] sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF4DDE]/12 px-2.5 py-0.5 text-[11px] font-bold text-[#A21CAF] dark:text-[#FF9EEA]">
                        <BrainCircuit className="h-3 w-3" aria-hidden="true" />
                        <span>Ringkasan Konsultasi EGO AI Core</span>
                      </span>
                      <p className="mt-2 text-sm font-semibold leading-relaxed text-[#101827] dark:text-white">
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
                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-[#1E293B] dark:bg-[#101827]">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#0D9488] dark:text-[#2DD4BF]">
                        1. Data Aktual Terverifikasi
                      </p>
                      <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                        {advisorMutation.data.data_aktual.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-[#1E293B] dark:bg-[#101827]">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#9A7411] dark:text-[#E6C768]">
                        2. Data Estimasi &amp; Forecast
                      </p>
                      <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                        {advisorMutation.data.data_estimasi.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-[#1E293B] dark:bg-[#101827]">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                        3. Hasil Simulasi Tersedia
                      </p>
                      <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                        {advisorMutation.data.hasil_simulasi.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-[#FF4DDE]/25 bg-white p-3.5 dark:bg-[#101827]">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#A21CAF] dark:text-[#FF9EEA]">
                        4. Rekomendasi AI (Keputusan Tetap di Owner)
                      </p>
                      <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
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

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Model: <span className="font-mono">{advisorMutation.data.model_used}</span> · Rekomendasi di atas hanya bersifat analitis dan tidak mencatat transaksi otomatis.
                  </p>
                </div>
              ) : null}
            </section>

            <div className="grid gap-6 lg:grid-cols-12">
              {/* Natural Language Input */}
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none sm:p-6 lg:col-span-7">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF4DDE]/12 text-[#A21CAF] dark:text-[#FF9EEA]">
                    <Bot className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <h2 className="text-base font-bold text-[#101827] dark:text-white">
                    Perintah Bahasa Alami (Parser Lokal)
                  </h2>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] placeholder:text-slate-400 focus:border-[#D4AF37] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/15 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:placeholder:text-slate-500"
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    {SAMPLE_COMMANDS.map((sample) => (
                      <button
                        key={sample}
                        type="button"
                        onClick={() => setCommandText(sample)}
                        className="min-h-[34px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-[#D4AF37]/45 hover:text-[#9A7411] dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-300 dark:hover:border-[#D4AF37]/45 dark:hover:text-[#E6C768]"
                      >
                        {sample}
                      </button>
                    ))}
                  </div>

                  {liveDraftPreview ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-[#1E293B] dark:bg-[#0B111E]">
                      <p className="mb-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Pratinjau Draf Terstruktur (JSON)
                      </p>
                      <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-[#9A7411] dark:text-[#E6C768]">
                        {JSON.stringify(liveDraftPreview, null, 2)}
                      </pre>
                    </div>
                  ) : null}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={queueCommand.isPending || !commandText.trim()}
                      className="ego-pressable inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2.5 text-sm font-semibold text-[#101827] shadow-sm shadow-[#D4AF37]/20 transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:from-[#162032] dark:disabled:to-[#162032] dark:disabled:text-slate-500"
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

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none sm:p-6">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D4AF37]/15 text-[#9A7411] dark:text-[#E6C768]">
                      <Globe className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <h2 className="text-base font-bold text-[#101827] dark:text-white">
                      Riset Keuangan (Google Search)
                    </h2>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    Dapatkan data kurs, harga emas, suku bunga, atau informasi ekonomi terbaru langsung dari Google Search.
                  </p>

                  <form onSubmit={handleSearch} className="mt-3 flex gap-2">
                    <input
                      type="text"
                      aria-label="Pertanyaan riset keuangan Google Search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Contoh: Harga emas Antam 1 gram hari ini"
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-[#101827] placeholder:text-slate-400 focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:placeholder:text-slate-500"
                    />
                    <button
                      type="submit"
                      disabled={searchMutation.isPending || !searchQuery.trim()}
                      className="ego-pressable inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#101827] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1E293B] disabled:opacity-50 dark:bg-[#D4AF37] dark:text-[#101827]"
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
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#101827] hover:bg-slate-50 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
                        >
                          <span>Cari Langsung di Google</span>
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      ) : null}
                    </div>
                  ) : searchMutation.data ? (
                    <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-200">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#9A7411] dark:text-[#E6C768]">
                          Ringkasan Terverifikasi Search
                        </span>
                        <TtsButton
                          text={searchMutation.data.answer}
                          label="Bacakan Jawaban"
                          compact
                        />
                      </div>
                      <p className="whitespace-pre-line text-slate-700 dark:text-slate-200">
                        {searchMutation.data.answer}
                      </p>
                      {searchMutation.data.sources.length > 0 ? (
                        <div className="border-t border-slate-200 pt-2 dark:border-[#1E293B]">
                          <p className="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            Sumber Referensi:
                          </p>
                          <ul className="space-y-1">
                            {searchMutation.data.sources.map((src) => (
                              <li key={src.uri}>
                                <a
                                  href={src.uri}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[#9A7411] hover:underline dark:text-[#E6C768]"
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
          </EgoStaggerSection>
        ) : null}

        {/* Owner Control Queue & History */}
        {showControlQueue ? (
          <EgoStaggerSection index={showAiTools ? 2 : 1} className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#101827] dark:text-white">
                    Antrean Persetujuan Owner ({pendingCommands.length})
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Setiap draf wajib Anda tinjau dan setujui secara eksplisit sebelum saldo akun berubah.
                  </p>
                </div>
              </div>

              {pendingCommands.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-[#1E293B] dark:bg-[#0B111E]/70">
                  <p className="text-sm font-bold text-[#101827] dark:text-white">
                    Antrean persetujuan bersih
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    Kirim perintah teks, suara, atau pindai struk untuk menyiapkan usulan transaksi baru.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200/80 dark:divide-[#1E293B]">
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
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none sm:p-6">
              <h2 className="text-base font-bold text-[#101827] dark:text-white">
                Log Riwayat Perintah Owner
              </h2>
              {historyCommands.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Belum ada riwayat perintah yang disetujui atau ditolak.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-slate-200/80 dark:divide-[#1E293B]">
                  {historyCommands.map((cmd) => (
                    <li
                      key={cmd.id}
                      className="flex flex-col justify-between gap-2 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#101827] dark:text-white">
                          &ldquo;{cmd.command_text}&rdquo;
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
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
                            ? "bg-[#14B8A6]/15 text-[#0D9488] dark:text-[#2DD4BF]"
                            : "bg-[#EF4444]/12 text-[#DC2626] dark:text-[#F87171]"
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
          </EgoStaggerSection>
        ) : null}
      </div>
    </AppShell>
  );
}
