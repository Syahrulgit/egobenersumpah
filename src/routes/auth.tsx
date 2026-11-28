import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { EgoCompanion, EgoLogoMark } from "../components/ego/ego-brand";
import {
  isPasswordRecoveryActive,
  parseAuthRedirectError,
  setPasswordRecoveryActive,
  subscribePasswordRecoveryChange,
  validateRecoveryPasswordInput,
} from "../lib/auth-recovery";
import {
  useAuthStatus,
  useLoginOwner,
  useRegisterOwner,
  useRequestPasswordReset,
  useResetLocalOwner,
  useUpdateRecoveryPassword,
} from "../lib/queries";
import { supabase, subscribeSupabaseChange } from "../lib/supabase";
import { ThemeToggleButton } from "../lib/theme";

export function AuthRoutePage() {
  const navigate = useNavigate();
  const { data: auth, isLoading } = useAuthStatus();
  const registerMutation = useRegisterOwner();
  const loginMutation = useLoginOwner();
  const resetOwnerMutation = useResetLocalOwner();
  const requestResetMutation = useRequestPasswordReset();
  const updateRecoveryPasswordMutation = useUpdateRecoveryPassword();

  const recoveryActive = useSyncExternalStore(
    subscribePasswordRecoveryChange,
    isPasswordRecoveryActive,
    () => false
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("Owner Utama");
  const [supabaseAction, setSupabaseAction] = useState<"login" | "register">("login");
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [newRecoveryPassword, setNewRecoveryPassword] = useState("");
  const [confirmRecoveryPassword, setConfirmRecoveryPassword] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [showResetPanel, setShowResetPanel] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [resetKeyword, setResetKeyword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    const redirectErr = parseAuthRedirectError(window.location.href);
    if (redirectErr) {
      setPasswordRecoveryActive(false);
      setForgotPasswordMode(true);
      setFormError(redirectErr);
      window.history.replaceState(null, "", "/auth");
    }
  }, []);

  useEffect(() => {
    let authUnsub: (() => void) | null = null;

    const attachListener = () => {
      if (authUnsub) {
        authUnsub();
        authUnsub = null;
      }
      if (!supabase) return;
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          setPasswordRecoveryActive(true);
          setForgotPasswordMode(false);
          setFormError(null);
          setFormNotice(null);
        }
      });
      authUnsub = () => subscription.unsubscribe();
    };

    attachListener();
    const unsubSupabase = subscribeSupabaseChange(attachListener);
    return () => {
      unsubSupabase();
      if (authUnsub) {
        authUnsub();
      }
    };
  }, []);

  useEffect(() => {
    if (auth?.authenticated && !recoveryActive) {
      void navigate({ to: "/" });
    }
  }, [auth?.authenticated, recoveryActive, navigate]);

  const isSupabaseMode = auth?.mode === "supabase";
  const isRecoveryView = isSupabaseMode && recoveryActive;
  const isForgotView = isSupabaseMode && forgotPasswordMode && !recoveryActive;
  const isRegistrationMode =
    !isRecoveryView &&
    !isForgotView &&
    (isSupabaseMode
      ? supabaseAction === "register"
      : auth
        ? !auth.hasOwner
        : false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormNotice(null);
    try {
      if (isRegistrationMode) {
        const res = await registerMutation.mutateAsync({
          email,
          password,
          full_name: fullName,
        });
        if (res.needsEmailConfirmation) {
          const msg = `Pendaftaran berhasil. Silakan buka kotak masuk ${email.trim()} dan klik tautan konfirmasi dari Supabase sebelum masuk.`;
          setFormNotice(msg);
          setSupabaseAction("login");
          toast.success("Tautan konfirmasi telah dikirim ke email Anda.");
          return;
        }
        toast.success("Brankas pribadi Anda siap digunakan.");
      } else {
        await loginMutation.mutateAsync({ email, password });
        toast.success("Selamat datang kembali di brankas Anda.");
      }
      await navigate({ to: "/" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Autentikasi Owner gagal.";
      setFormError(message);
      toast.error(message);
    }
  }

  async function handleForgotPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormNotice(null);
    try {
      const res = await requestResetMutation.mutateAsync({ email: recoveryEmail });
      setFormNotice(res.message);
      toast.success("Permintaan pemulihan kata sandi telah diproses.");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Gagal mengirim tautan pemulihan kata sandi.";
      setFormError(message);
      toast.error(message);
    }
  }

  async function handleRecoveryPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormNotice(null);

    const validation = validateRecoveryPasswordInput(
      newRecoveryPassword,
      confirmRecoveryPassword
    );
    if (!validation.valid) {
      setFormError(validation.message);
      toast.error(validation.message);
      return;
    }

    try {
      await updateRecoveryPasswordMutation.mutateAsync({
        newPassword: newRecoveryPassword,
        confirmPassword: confirmRecoveryPassword,
      });
      setNewRecoveryPassword("");
      setConfirmRecoveryPassword("");
      window.history.replaceState(null, "", "/auth");
      toast.success("Kata sandi baru berhasil disimpan. Mengarahkan ke dashboard...");
      await navigate({ to: "/" });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Gagal memperbarui kata sandi baru.";
      setFormError(message);
      toast.error(message);
    }
  }

  async function handleCancelRecovery() {
    setFormError(null);
    setFormNotice(null);
    setNewRecoveryPassword("");
    setConfirmRecoveryPassword("");
    setPasswordRecoveryActive(false);
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    window.history.replaceState(null, "", "/auth");
    setSupabaseAction("login");
    setForgotPasswordMode(false);
  }

  async function handleResetLocalOwner(e: React.FormEvent) {
    e.preventDefault();
    setResetError(null);
    try {
      await resetOwnerMutation.mutateAsync({
        confirmed: resetConfirmed,
        confirmation_text: resetKeyword,
      });
      setShowResetPanel(false);
      setResetConfirmed(false);
      setResetKeyword("");
      setFormError(null);
      setEmail("");
      setPassword("");
      toast.success(
        "Akun Owner lama berhasil dihapus. Silakan daftar ulang dengan email yang benar."
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menghapus akun Owner.";
      setResetError(message);
      toast.error(message);
    }
  }

  const pending =
    registerMutation.isPending ||
    loginMutation.isPending ||
    resetOwnerMutation.isPending ||
    requestResetMutation.isPending ||
    updateRecoveryPasswordMutation.isPending;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#F6F7FB] px-4 py-10 transition-colors duration-200 dark:bg-[#0B111E]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#D4AF37]/12 blur-3xl dark:bg-[#D4AF37]/10"
      />

      <div className="relative z-10 mb-4 flex w-full max-w-md justify-end">
        <ThemeToggleButton />
      </div>

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-[#101827]/10 dark:border-[#D4AF37]/25 dark:bg-[#101827] dark:shadow-none">
        {/* Midnight Navy + Champagne Gold Luxury Vault Header */}
        <div className="ego-card-hero border-b border-[#D4AF37]/25 px-6 py-6 text-white sm:px-8">
          <div className="flex items-center justify-between gap-3.5">
            <div className="flex min-w-0 items-center gap-3.5">
              <EgoLogoMark size="lg" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-lg font-bold tracking-tight text-white">
                    EGO <span className="text-[#E6C768]">Personal AI</span>
                  </h1>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#E6C768]">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                    Vault
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-300">
                  Wealth Management &amp; Brankas Pribadi Single-Owner
                </p>
              </div>
            </div>
            <EgoCompanion
              size="sm"
              mode={pending ? "thinking" : formError ? "alert" : "idle"}
              className="shrink-0"
            />
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-600 dark:text-slate-300">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#D4AF37]" />
              <span>Menyiapkan brankas Anda...</span>
            </div>
          ) : isRecoveryView ? (
            <>
              <div className="mb-5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/8 p-3.5 text-xs leading-relaxed text-slate-700 dark:border-[#D4AF37]/30 dark:bg-[#162032] dark:text-slate-300">
                <strong className="text-[#9A7411] dark:text-[#E6C768]">
                  Atur Kata Sandi Baru:
                </strong>{" "}
                Tautan pemulihan terverifikasi. Masukkan kata sandi baru minimal 6 karakter untuk membuka kembali akses brankas Anda.
              </div>

              <form onSubmit={handleRecoveryPasswordSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="recovery-new-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Kata Sandi Baru
                  </label>
                  <input
                    id="recovery-new-password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={newRecoveryPassword}
                    onChange={(e) => setNewRecoveryPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-[#101827] placeholder:text-slate-400 focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/25 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#D4AF37]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="recovery-confirm-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Konfirmasi Kata Sandi
                  </label>
                  <input
                    id="recovery-confirm-password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={confirmRecoveryPassword}
                    onChange={(e) => setConfirmRecoveryPassword(e.target.value)}
                    placeholder="Ulangi kata sandi baru"
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-[#101827] placeholder:text-slate-400 focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/25 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#D4AF37]"
                  />
                </div>

                {formNotice ? (
                  <div
                    role="status"
                    className="rounded-xl border border-[#14B8A6]/35 bg-[#14B8A6]/10 px-3.5 py-2.5 text-xs font-medium text-[#0D9488] dark:border-[#14B8A6]/35 dark:bg-[#14B8A6]/12 dark:text-[#2DD4BF]"
                  >
                    {formNotice}
                  </div>
                ) : null}

                {formError ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-[#EF4444]/35 bg-[#EF4444]/10 px-3.5 py-2.5 text-xs font-medium text-[#DC2626] dark:border-[#EF4444]/35 dark:bg-[#EF4444]/12 dark:text-[#F87171]"
                  >
                    {formError}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={pending}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E6C768] to-[#D4AF37] px-4 py-3 text-sm font-bold text-[#101827] shadow-md shadow-[#D4AF37]/20 transition-all hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] disabled:opacity-60"
                >
                  {updateRecoveryPasswordMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>Simpan Kata Sandi Baru</span>
                </button>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void handleCancelRecovery()}
                  className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-[#101827] dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-300 dark:hover:bg-[#162032] dark:hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Batalkan Pemulihan</span>
                </button>
              </form>

              <div className="mt-6 flex items-center gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-[#1E293B] dark:text-slate-400">
                <Lock className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" aria-hidden="true" />
                <span>Penyimpanan: Supabase Cloud (RLS Aktif)</span>
              </div>
            </>
          ) : isForgotView ? (
            <>
              <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700 dark:border-[#1E293B] dark:bg-[#162032] dark:text-slate-300">
                <strong className="text-[#9A7411] dark:text-[#E6C768]">
                  Pemulihan Kata Sandi:
                </strong>{" "}
                Masukkan alamat email akun Supabase Anda untuk menerima tautan pengaturan kata sandi baru.
              </div>

              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="forgot-password-email"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Email Akun Terdaftar
                  </label>
                  <input
                    id="forgot-password-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="owner@domain.id"
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-[#101827] placeholder:text-slate-400 focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/25 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#D4AF37]"
                  />
                </div>

                {formNotice ? (
                  <div
                    role="status"
                    className="rounded-xl border border-[#14B8A6]/35 bg-[#14B8A6]/10 px-3.5 py-2.5 text-xs font-medium text-[#0D9488] dark:border-[#14B8A6]/35 dark:bg-[#14B8A6]/12 dark:text-[#2DD4BF]"
                  >
                    {formNotice}
                  </div>
                ) : null}

                {formError ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-[#EF4444]/35 bg-[#EF4444]/10 px-3.5 py-2.5 text-xs font-medium text-[#DC2626] dark:border-[#EF4444]/35 dark:bg-[#EF4444]/12 dark:text-[#F87171]"
                  >
                    {formError}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={pending}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E6C768] to-[#D4AF37] px-4 py-3 text-sm font-bold text-[#101827] shadow-md shadow-[#D4AF37]/20 transition-all hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] disabled:opacity-60"
                >
                  {requestResetMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Mail className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>Kirim Tautan Pemulihan</span>
                </button>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setForgotPasswordMode(false);
                    setFormError(null);
                    setFormNotice(null);
                  }}
                  className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-[#101827] dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-300 dark:hover:bg-[#162032] dark:hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Kembali ke Masuk Owner</span>
                </button>
              </form>

              <div className="mt-6 flex items-center gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-[#1E293B] dark:text-slate-400">
                <Lock className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" aria-hidden="true" />
                <span>Penyimpanan: Supabase Cloud (RLS Aktif)</span>
              </div>
            </>
          ) : (
            <>
              {isSupabaseMode ? (
                <div
                  role="tablist"
                  aria-label="Mode autentikasi Supabase"
                  className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1 dark:border-[#1E293B] dark:bg-[#0B111E]"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={supabaseAction === "login"}
                    onClick={() => {
                      setSupabaseAction("login");
                      setForgotPasswordMode(false);
                      setFormError(null);
                      setFormNotice(null);
                    }}
                    className={`min-h-[40px] rounded-xl py-2 text-xs font-semibold transition-colors ${
                      supabaseAction === "login"
                        ? "bg-[#101827] text-[#E6C768] shadow-xs ring-1 ring-[#D4AF37]/35 dark:bg-[#D4AF37] dark:text-[#101827]"
                        : "text-slate-600 hover:text-[#101827] dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    Masuk Owner
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={supabaseAction === "register"}
                    onClick={() => {
                      setSupabaseAction("register");
                      setForgotPasswordMode(false);
                      setFormError(null);
                      setFormNotice(null);
                    }}
                    className={`min-h-[40px] rounded-xl py-2 text-xs font-semibold transition-colors ${
                      supabaseAction === "register"
                        ? "bg-[#101827] text-[#E6C768] shadow-xs ring-1 ring-[#D4AF37]/35 dark:bg-[#D4AF37] dark:text-[#101827]"
                        : "text-slate-600 hover:text-[#101827] dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    Daftar Owner Pertama
                  </button>
                </div>
              ) : null}

              <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700 dark:border-[#1E293B] dark:bg-[#162032] dark:text-slate-300">
                {isRegistrationMode ? (
                  <span>
                    <strong className="text-[#9A7411] dark:text-[#E6C768]">
                      Selamat datang! Buat akun Owner pertama Anda:
                    </strong>{" "}
                    Sistem ini khusus untuk satu pemilik tunggal. Akun kedua akan ditolak otomatis demi privasi brankas.
                  </span>
                ) : (
                  <span>
                    <strong className="text-[#101827] dark:text-white">
                      Brankas Terkunci (Single-Owner):
                    </strong>{" "}
                    Masuk menggunakan kredensial Owner Anda untuk membuka akses.
                  </span>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {isRegistrationMode ? (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="owner-name"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Nama Panggilan / Owner
                    </label>
                    <input
                      id="owner-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Owner Utama"
                      className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-[#101827] placeholder:text-slate-400 focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/25 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#D4AF37]"
                    />
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <label
                    htmlFor="owner-email"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Email Owner
                  </label>
                  <input
                    id="owner-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@domain.id"
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-[#101827] placeholder:text-slate-400 focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/25 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#D4AF37]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="owner-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Kata Sandi Brankas
                  </label>
                  <input
                    id="owner-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-[#101827] placeholder:text-slate-400 focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/25 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#D4AF37]"
                  />
                  {isSupabaseMode && !isRegistrationMode ? (
                    <div className="flex justify-end pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setRecoveryEmail(email.trim());
                          setForgotPasswordMode(true);
                          setFormError(null);
                          setFormNotice(null);
                        }}
                        className="text-xs font-medium text-[#9A7411] underline decoration-[#D4AF37]/40 underline-offset-4 transition-colors hover:text-[#101827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] dark:text-[#E6C768] dark:hover:text-white"
                      >
                        Lupa Kata Sandi?
                      </button>
                    </div>
                  ) : null}
                </div>

                {formNotice ? (
                  <div
                    role="status"
                    className="rounded-xl border border-[#14B8A6]/35 bg-[#14B8A6]/10 px-3.5 py-2.5 text-xs font-medium text-[#0D9488] dark:border-[#14B8A6]/35 dark:bg-[#14B8A6]/12 dark:text-[#2DD4BF]"
                  >
                    {formNotice}
                  </div>
                ) : null}

                {formError ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-[#EF4444]/35 bg-[#EF4444]/10 px-3.5 py-2.5 text-xs font-medium text-[#DC2626] dark:border-[#EF4444]/35 dark:bg-[#EF4444]/12 dark:text-[#F87171]"
                  >
                    {formError}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={pending}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E6C768] to-[#D4AF37] px-4 py-3 text-sm font-bold text-[#101827] shadow-md shadow-[#D4AF37]/20 transition-all hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] disabled:opacity-60"
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : isRegistrationMode ? (
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>
                    {isRegistrationMode
                      ? "Daftarkan Owner Tunggal"
                      : "Buka Brankas Owner"}
                  </span>
                </button>
              </form>

              {!isSupabaseMode && !isRegistrationMode ? (
                <div className="mt-5 border-t border-slate-200 pt-4 dark:border-[#1E293B]">
                  <button
                    type="button"
                    aria-expanded={showResetPanel}
                    onClick={() => {
                      setShowResetPanel((v) => !v);
                      setResetError(null);
                    }}
                    className="text-xs font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-[#DC2626] dark:text-slate-400 dark:decoration-[#1E293B] dark:hover:text-[#F87171]"
                  >
                    Email salah atau tidak bisa masuk? Hapus Akun Owner
                  </button>

                  {showResetPanel ? (
                    <form
                      onSubmit={handleResetLocalOwner}
                      className="mt-3 space-y-3 rounded-2xl border border-[#EF4444]/30 bg-[#EF4444]/6 p-4 dark:border-[#EF4444]/30 dark:bg-[#EF4444]/10"
                    >
                      <div className="flex items-start gap-2.5 text-xs leading-relaxed text-[#7F1D1D] dark:text-[#FECACA]">
                        <AlertTriangle
                          className="mt-0.5 h-4 w-4 shrink-0 text-[#EF4444]"
                          aria-hidden="true"
                        />
                        <p>
                          Jika Anda salah memasukkan email saat pendaftaran atau lupa kata sandi, Anda dapat menghapus akun Owner saat ini untuk mendaftar ulang. Demi keamanan, seluruh data brankas lokal akan dikosongkan.
                        </p>
                      </div>

                      <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-800 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={resetConfirmed}
                          onChange={(e) => setResetConfirmed(e.target.checked)}
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#EF4444]/40 accent-[#EF4444]"
                        />
                        <span>
                          Saya setuju menghapus akun Owner dan mengosongkan seluruh data brankas lokal saat ini.
                        </span>
                      </label>

                      <div className="space-y-1">
                        <label
                          htmlFor="reset-owner-keyword"
                          className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                        >
                          Ketik <span className="font-mono font-semibold">HAPUS</span> untuk konfirmasi
                        </label>
                        <input
                          id="reset-owner-keyword"
                          type="text"
                          value={resetKeyword}
                          onChange={(e) => setResetKeyword(e.target.value)}
                          placeholder="HAPUS"
                          autoComplete="off"
                          className="min-h-[40px] w-full rounded-xl border border-[#EF4444]/35 bg-white px-3 py-2 text-sm text-[#101827] placeholder:text-slate-400 focus:border-[#EF4444] focus:outline-none dark:border-[#EF4444]/35 dark:bg-[#0B111E] dark:text-white"
                        />
                      </div>

                      {resetError ? (
                        <div
                          role="alert"
                          className="rounded-xl border border-[#EF4444]/40 bg-white px-3 py-2 text-xs font-medium text-[#DC2626] dark:bg-[#0B111E] dark:text-[#F87171]"
                        >
                          {resetError}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          disabled={resetOwnerMutation.isPending}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#EF4444] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#DC2626] disabled:opacity-60"
                        >
                          {resetOwnerMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          <span>Hapus Akun Owner &amp; Daftar Ulang</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowResetPanel(false);
                            setResetConfirmed(false);
                            setResetKeyword("");
                            setResetError(null);
                          }}
                          className="min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-[#1E293B] dark:bg-[#101827] dark:text-slate-300"
                        >
                          Batal
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-6 flex items-center gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-[#1E293B] dark:text-slate-400">
                <Lock className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" aria-hidden="true" />
                <span>
                  Penyimpanan:{" "}
                  {auth?.mode === "supabase"
                    ? "Supabase Cloud (RLS Aktif)"
                    : "Brankas Server Lokal (Siap Supabase)"}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
