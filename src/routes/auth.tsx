import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EgoLogoMark } from "../components/ego/ego-brand";
import {
  useAuthStatus,
  useLoginOwner,
  useRegisterOwner,
  useResetLocalOwner,
} from "../lib/queries";
import { ThemeToggleButton } from "../lib/theme";

export function AuthRoutePage() {
  const navigate = useNavigate();
  const { data: auth, isLoading } = useAuthStatus();
  const registerMutation = useRegisterOwner();
  const loginMutation = useLoginOwner();
  const resetOwnerMutation = useResetLocalOwner();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("Owner Utama");
  const [supabaseAction, setSupabaseAction] = useState<"login" | "register">("login");
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [showResetPanel, setShowResetPanel] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [resetKeyword, setResetKeyword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    if (auth?.authenticated) {
      void navigate({ to: "/" });
    }
  }, [auth?.authenticated, navigate]);

  const isSupabaseMode = auth?.mode === "supabase";
  const isRegistrationMode = isSupabaseMode
    ? supabaseAction === "register"
    : auth
      ? !auth.hasOwner
      : false;

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
    resetOwnerMutation.isPending;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#F4F7FB] px-4 py-10 transition-colors duration-200 dark:bg-[#040B1C]">
      {/* Subtle EGO Ambient Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#087BFF]/12 blur-3xl dark:bg-[#19D8FF]/12"
      />

      <div className="relative z-10 mb-4 flex w-full max-w-md justify-end">
        <ThemeToggleButton />
      </div>

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-[#DCE4F0] bg-white shadow-xl shadow-[#06132F]/8 dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none">
        {/* Midnight Navy Fintech Header Strip */}
        <div className="ego-card-hero border-b border-[#1B3163] px-6 py-6 text-white sm:px-8">
          <div className="flex items-center gap-3.5">
            <EgoLogoMark size="lg" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  EGO Personal AI
                </h1>
                <span className="inline-flex items-center gap-1 rounded-md border border-[#19D8FF]/30 bg-[#19D8FF]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#19D8FF]">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  Vault
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#C7D0E0]">
                Wealth Management &amp; Brankas Pribadi Single-Owner
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-600 dark:text-[#C7D0E0]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#087BFF] dark:text-[#19D8FF]" />
              <span>Menyiapkan brankas Anda...</span>
            </div>
          ) : (
            <>
              {isSupabaseMode ? (
                <div
                  role="tablist"
                  aria-label="Mode autentikasi Supabase"
                  className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-[#DCE4F0] bg-[#EEF3FA] p-1 dark:border-[#1B3163] dark:bg-[#06132F]"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={supabaseAction === "login"}
                    onClick={() => {
                      setSupabaseAction("login");
                      setFormError(null);
                      setFormNotice(null);
                    }}
                    className={`min-h-[40px] rounded-xl py-2 text-xs font-semibold transition-colors ${
                      supabaseAction === "login"
                        ? "bg-[#087BFF] text-white shadow-xs"
                        : "text-slate-600 hover:text-[#06132F] dark:text-[#C7D0E0]/75 dark:hover:text-white"
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
                      setFormError(null);
                      setFormNotice(null);
                    }}
                    className={`min-h-[40px] rounded-xl py-2 text-xs font-semibold transition-colors ${
                      supabaseAction === "register"
                        ? "bg-[#087BFF] text-white shadow-xs"
                        : "text-slate-600 hover:text-[#06132F] dark:text-[#C7D0E0]/75 dark:hover:text-white"
                    }`}
                  >
                    Daftar Owner Pertama
                  </button>
                </div>
              ) : null}

              <div className="mb-5 rounded-2xl border border-[#DCE4F0] bg-[#F4F7FB] p-3.5 text-xs leading-relaxed text-slate-700 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]">
                {isRegistrationMode ? (
                  <span>
                    <strong className="text-[#087BFF] dark:text-[#19D8FF]">
                      Selamat datang! Buat akun Owner pertama Anda:
                    </strong>{" "}
                    Sistem ini khusus untuk satu pemilik tunggal. Akun kedua akan ditolak otomatis demi privasi brankas.
                  </span>
                ) : (
                  <span>
                    <strong className="text-[#06132F] dark:text-white">
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
                      className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
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
                      className="min-h-[44px] w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] placeholder:text-slate-400 focus:border-[#087BFF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087BFF]/20 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#19D8FF]"
                    />
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <label
                    htmlFor="owner-email"
                    className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
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
                    className="min-h-[44px] w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] placeholder:text-slate-400 focus:border-[#087BFF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087BFF]/20 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#19D8FF]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="owner-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
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
                    className="min-h-[44px] w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] placeholder:text-slate-400 focus:border-[#087BFF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087BFF]/20 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#19D8FF]"
                  />
                </div>

                {formNotice ? (
                  <div
                    role="status"
                    className="rounded-xl border border-[#087BFF]/30 bg-[#087BFF]/10 px-3.5 py-2.5 text-xs font-medium text-[#087BFF] dark:border-[#19D8FF]/30 dark:bg-[#19D8FF]/10 dark:text-[#19D8FF]"
                  >
                    {formNotice}
                  </div>
                ) : null}

                {formError ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                  >
                    {formError}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={pending}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-[#087BFF]/20 transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#19D8FF] disabled:opacity-60"
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
                <div className="mt-5 border-t border-[#DCE4F0] pt-4 dark:border-[#1B3163]">
                  <button
                    type="button"
                    aria-expanded={showResetPanel}
                    onClick={() => {
                      setShowResetPanel((v) => !v);
                      setResetError(null);
                    }}
                    className="text-xs font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-rose-700 dark:text-[#C7D0E0]/75 dark:decoration-[#1B3163] dark:hover:text-rose-300"
                  >
                    Email salah atau tidak bisa masuk? Hapus Akun Owner
                  </button>

                  {showResetPanel ? (
                    <form
                      onSubmit={handleResetLocalOwner}
                      className="mt-3 space-y-3 rounded-2xl border border-rose-200/90 bg-rose-50/70 p-4 dark:border-rose-500/30 dark:bg-rose-950/20"
                    >
                      <div className="flex items-start gap-2.5 text-xs leading-relaxed text-rose-900 dark:text-rose-200">
                        <AlertTriangle
                          className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400"
                          aria-hidden="true"
                        />
                        <p>
                          Jika Anda salah memasukkan email saat pendaftaran atau lupa kata sandi, Anda dapat menghapus akun Owner saat ini untuk mendaftar ulang. Demi keamanan, seluruh data brankas lokal akan dikosongkan.
                        </p>
                      </div>

                      <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-800 dark:text-[#C7D0E0]">
                        <input
                          type="checkbox"
                          checked={resetConfirmed}
                          onChange={(e) => setResetConfirmed(e.target.checked)}
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-rose-300 accent-rose-600"
                        />
                        <span>
                          Saya setuju menghapus akun Owner dan mengosongkan seluruh data brankas lokal saat ini.
                        </span>
                      </label>

                      <div className="space-y-1">
                        <label
                          htmlFor="reset-owner-keyword"
                          className="block text-xs font-medium text-slate-700 dark:text-[#C7D0E0]"
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
                          className="min-h-[40px] w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-[#06132F] placeholder:text-slate-400 focus:border-rose-500 focus:outline-none dark:border-rose-500/30 dark:bg-[#06132F] dark:text-white"
                        />
                      </div>

                      {resetError ? (
                        <div
                          role="alert"
                          className="rounded-xl border border-rose-300 bg-white/90 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-500/40 dark:bg-[#06132F] dark:text-rose-300"
                        >
                          {resetError}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          disabled={resetOwnerMutation.isPending}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
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
                          className="min-h-[38px] rounded-xl border border-[#DCE4F0] bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-[#1B3163] dark:bg-[#091634] dark:text-[#C7D0E0]"
                        >
                          Batal
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-6 flex items-center gap-2 border-t border-[#DCE4F0] pt-4 text-xs text-slate-500 dark:border-[#1B3163] dark:text-[#C7D0E0]/65">
                <Lock className="h-3.5 w-3.5 shrink-0 text-[#087BFF] dark:text-[#19D8FF]" aria-hidden="true" />
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
