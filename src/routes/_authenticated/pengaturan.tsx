import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../../components/ego/app-shell";
import { MoneyInput } from "../../components/ego/money-input";
import { PWAInstallButton } from "../../components/ego/pwa-controls";
import {
  transactionsToCsv,
  triggerBrowserDownload,
  vaultSnapshotToBackupJson,
} from "../../lib/export";
import { todayISO } from "../../lib/finance";
import {
  isAutoLockEnabled,
  setAutoLockEnabled,
  setPinLocked,
} from "../../lib/pin-lock";
import { usePWAInstall } from "../../lib/pwa";
import {
  egoKeys,
  useAuthStatus,
  useChangePassword,
  useDeleteLocalOwner,
  useDisablePin,
  useHealthStatus,
  useLogoutOwner,
  useSetupPin,
  useUpdateOwnerProfile,
  useUpdatePreferences,
  useVaultSnapshot,
} from "../../lib/queries";
import { isSupabaseConfigured } from "../../lib/supabase";
import { ThemeToggleButton } from "../../lib/theme";
import type { DateFormatPref } from "../../types/ego";

export function PengaturanPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: auth } = useAuthStatus();
  const { data: vault, isFetching } = useVaultSnapshot(true);
  const { data: health } = useHealthStatus();
  const updatePrefs = useUpdatePreferences();
  const logout = useLogoutOwner();
  const changePassword = useChangePassword();
  const updateProfile = useUpdateOwnerProfile();
  const deleteOwner = useDeleteLocalOwner();
  const setupPin = useSetupPin();
  const disablePin = useDisablePin();
  const { isInstalled } = usePWAInstall();

  const [dateFormat, setDateFormat] = useState<DateFormatPref>("DD MMM YYYY");
  const [expenseLimit, setExpenseLimit] = useState(5_000_000);

  // Edit Owner profile form state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePassword, setProfilePassword] = useState("");

  // Delete Owner form state
  const [deletingOwner, setDeletingOwner] = useState(false);
  const [deleteOwnerPassword, setDeleteOwnerPassword] = useState("");
  const [deleteOwnerConfirmed, setDeleteOwnerConfirmed] = useState(false);

  // Change Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Quick 6-digit PIN form state
  const [autoLock, setAutoLock] = useState(() => isAutoLockEnabled());
  const [editingPin, setEditingPin] = useState(false);
  const [disablingPin, setDisablingPin] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinPassword, setPinPassword] = useState("");
  const [disablePinPassword, setDisablePinPassword] = useState("");

  useEffect(() => {
    if (vault?.preferences) {
      setDateFormat(vault.preferences.date_format);
      setExpenseLimit(vault.preferences.expense_alert_limit);
    }
  }, [vault?.preferences]);

  useEffect(() => {
    if (auth?.owner && !editingProfile) {
      setProfileName(auth.owner.full_name);
      setProfileEmail(auth.owner.email);
    }
  }, [auth?.owner, editingProfile]);

  async function handleSavePrefs(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updatePrefs.mutateAsync({
        date_format: dateFormat,
        expense_alert_limit: expenseLimit,
      });
      toast.success("Preferensi Owner berhasil disimpan.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyimpan preferensi."
      );
    }
  }

  async function handleResync() {
    await qc.invalidateQueries({ queryKey: egoKeys.vault });
    toast.success("Data brankas berhasil disinkronkan ulang.");
  }

  async function handleLogout() {
    await logout.mutateAsync();
    toast.success("Seluruh cache sesi telah dibersihkan.");
    await navigate({ to: "/auth" });
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await updateProfile.mutateAsync({
        email: profileEmail,
        full_name: profileName,
        current_password: profilePassword,
      });
      setEditingProfile(false);
      setProfilePassword("");
      toast.success(
        isSupabaseConfigured
          ? res.emailChanged
            ? "Pembaruan email diajukan. Periksa kotak masuk email baru Anda bila diminta konfirmasi."
            : "Nama panggilan Owner berhasil diperbarui."
          : "Identitas & email Owner berhasil diperbarui."
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memperbarui identitas Owner."
      );
    }
  }

  async function handleDeleteOwner(e: React.FormEvent) {
    e.preventDefault();
    if (!deleteOwnerConfirmed) {
      toast.error("Centang persetujuan penghapusan akun Owner terlebih dahulu.");
      return;
    }
    if (!deleteOwnerPassword) {
      toast.error("Masukkan kata sandi Owner saat ini untuk verifikasi.");
      return;
    }
    try {
      await deleteOwner.mutateAsync({
        current_password: deleteOwnerPassword,
        confirmed: deleteOwnerConfirmed,
      });
      toast.success("Akun Owner berhasil dihapus. Silakan daftarkan Owner baru.");
      await navigate({ to: "/auth" });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menghapus akun Owner."
      );
    }
  }

  function handleExportCsv() {
    if (!vault) return;
    const csv = transactionsToCsv(vault.transactions, vault.accounts);
    triggerBrowserDownload(
      `ego-transaksi-${todayISO()}.csv`,
      csv,
      "text/csv;charset=utf-8;"
    );
    toast.success("Laporan transaksi CSV berhasil diunduh.");
  }

  function handleExportJsonBackup() {
    if (!vault) return;
    const json = vaultSnapshotToBackupJson(vault, auth?.owner?.email ?? null);
    triggerBrowserDownload(
      `ego-cadangan-brankas-${todayISO()}.json`,
      json,
      "application/json;charset=utf-8;"
    );
    toast.success("Cadangan lengkap brankas (JSON) berhasil diunduh.");
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Masukkan kata sandi saat ini terlebih dahulu.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Kata sandi baru minimal 6 karakter.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("Konfirmasi kata sandi baru tidak cocok.");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("Kata sandi baru harus berbeda dari kata sandi saat ini.");
      return;
    }

    try {
      await changePassword.mutateAsync({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      toast.success(
        "Kata sandi brankas diperbarui. Sesi perangkat lain telah diputus demi keamanan."
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mengganti kata sandi."
      );
    }
  }

  async function handleSavePin(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(pinValue)) {
      toast.error("PIN cepat wajib terdiri dari tepat 6 digit angka.");
      return;
    }
    if (pinValue !== pinConfirm) {
      toast.error("Konfirmasi PIN 6 digit tidak cocok.");
      return;
    }
    if (!pinPassword) {
      toast.error("Masukkan kata sandi Owner saat ini untuk verifikasi.");
      return;
    }

    try {
      await setupPin.mutateAsync({
        current_password: pinPassword,
        pin: pinValue,
      });
      setPinValue("");
      setPinConfirm("");
      setPinPassword("");
      setEditingPin(false);
      setDisablingPin(false);
      toast.success("Kunci PIN cepat 6 digit berhasil diaktifkan.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyimpan kunci PIN."
      );
    }
  }

  async function handleDisablePin(e: React.FormEvent) {
    e.preventDefault();
    if (!disablePinPassword) {
      toast.error("Masukkan kata sandi Owner untuk menonaktifkan PIN.");
      return;
    }
    try {
      await disablePin.mutateAsync(disablePinPassword);
      setDisablePinPassword("");
      setDisablingPin(false);
      setEditingPin(false);
      toast.success("Kunci PIN cepat berhasil dinonaktifkan.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menonaktifkan kunci PIN."
      );
    }
  }

  function handleToggleAutoLock(checked: boolean) {
    setAutoLock(checked);
    setAutoLockEnabled(checked);
    toast.success(
      checked
        ? "Kunci PIN otomatis saat aplikasi dibuka diaktifkan."
        : "Kunci PIN otomatis dinonaktifkan; Anda tetap bisa mengunci layar secara manual."
    );
  }

  const diagnostics = [
    {
      label: "Sesi Autentikasi Owner",
      status: auth?.authenticated ? "Aktif & Terverifikasi" : "Tidak Aktif",
      ok: Boolean(auth?.authenticated),
    },
    {
      label: "Koneksi Penyimpanan Data",
      status: isSupabaseConfigured
        ? "Supabase Cloud Terhubung"
        : "Brankas Server Lokal (Siap Supabase)",
      ok: isSupabaseConfigured || Boolean(health?.ok),
    },
    {
      label: "Kebijakan Keamanan & RLS",
      status: isSupabaseConfigured
        ? "RLS owner_id = auth.uid() Aktif"
        : "Single-Owner + Pembatas Login Aktif",
      ok: true,
    },
    {
      label: "Mode Aplikasi Harian (PWA)",
      status: isInstalled
        ? "Terpasang (Standalone)"
        : "Siap Dipasang di Ponsel",
      ok: true,
    },
  ];

  return (
    <AppShell
      title="Pengaturan Owner"
      subtitle="Sesuaikan tampilan, keamanan PIN, cadangan data brankas, dan status Supabase Cloud."
    >
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Identitas, PIN, Diagnostik & PWA */}
        <section className="space-y-6 lg:col-span-6">
          {/* Identitas Owner */}
          <div className="rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-[#06132F] dark:text-white">
                Identitas Owner Aktif
              </h2>
              <button
                type="button"
                onClick={() => {
                  setEditingProfile((v) => !v);
                  setProfilePassword("");
                  if (auth?.owner) {
                    setProfileName(auth.owner.full_name);
                    setProfileEmail(auth.owner.email);
                  }
                }}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3 py-1.5 text-xs font-semibold text-[#06132F] transition-colors hover:border-[#087BFF]/40 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0] dark:hover:border-[#19D8FF]/40"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{editingProfile ? "Tutup" : "Ubah Email / Nama"}</span>
              </button>
            </div>
            <div className="mt-4 space-y-2.5 border-t border-[#DCE4F0] pt-4 text-sm dark:border-[#1B3163]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 dark:text-[#C7D0E0]/75">Nama</span>
                <span className="font-semibold text-[#06132F] dark:text-white">
                  {auth?.owner?.full_name ?? "Owner Utama"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 dark:text-[#C7D0E0]/75">
                  Email Terdaftar
                </span>
                <span className="truncate font-mono text-xs text-[#06132F] dark:text-white">
                  {auth?.owner?.email ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 dark:text-[#C7D0E0]/75">
                  Arsitektur Akses
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#087BFF] dark:text-[#19D8FF]">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Single-Owner Mutlak
                </span>
              </div>
            </div>

            {editingProfile ? (
              <form
                onSubmit={handleUpdateProfile}
                className="mt-4 space-y-3 border-t border-[#DCE4F0] pt-4 dark:border-[#1B3163]"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label
                      htmlFor="profile-name-input"
                      className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
                    >
                      Nama Panggilan Owner
                    </label>
                    <input
                      id="profile-name-input"
                      type="text"
                      required
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3 py-2 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="profile-email-input"
                      className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
                    >
                      Email Owner Baru
                    </label>
                    <input
                      id="profile-email-input"
                      type="email"
                      required
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3 py-2 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="profile-password-input"
                    className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
                  >
                    Kata Sandi Saat Ini (Verifikasi)
                  </label>
                  <input
                    id="profile-password-input"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={profilePassword}
                    onChange={(e) => setProfilePassword(e.target.value)}
                    placeholder="Masukkan kata sandi brankas Anda"
                    className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3 py-2 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={updateProfile.isPending}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
                  >
                    {updateProfile.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : null}
                    <span>Simpan Identitas Baru</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProfile(false);
                      setProfilePassword("");
                    }}
                    className="min-h-[40px] rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]"
                  >
                    Batal
                  </button>
                </div>
              </form>
            ) : null}
          </div>

          {/* Kunci PIN Cepat 6 Digit */}
          <div className="rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
                  <Lock className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#06132F] dark:text-white">
                    Kunci PIN Cepat (6 Digit)
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-[#C7D0E0]/75">
                    Buka brankas harian di ponsel lebih cepat tanpa mengetik ulang kata sandi panjang.
                  </p>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  auth?.hasPin
                    ? "bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]"
                    : "bg-slate-100 text-slate-500 dark:bg-[#06132F] dark:text-[#C7D0E0]/65"
                }`}
              >
                {auth?.hasPin ? "Aktif" : "Belum Aktif"}
              </span>
            </div>

            {auth?.hasPin && !editingPin ? (
              <div className="mt-4 space-y-4 border-t border-[#DCE4F0] pt-4 dark:border-[#1B3163]">
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3.5 dark:border-[#1B3163] dark:bg-[#06132F]">
                  <div>
                    <p className="text-xs font-semibold text-[#06132F] dark:text-white">
                      Kunci otomatis saat aplikasi dibuka
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/75">
                      Meminta PIN 6 digit setiap kali membuka jendela atau PWA baru.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoLock}
                    onChange={(e) => handleToggleAutoLock(e.target.checked)}
                    className="h-4 w-4 rounded border-[#DCE4F0] accent-[#087BFF]"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPinLocked(true);
                      toast.success("Layar brankas dikunci.");
                    }}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:brightness-110"
                  >
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Kunci Layar Sekarang</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPin(true);
                      setDisablingPin(false);
                    }}
                    className="min-h-[40px] rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2 text-xs font-semibold text-[#06132F] hover:bg-slate-200 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0] dark:hover:bg-[#0D1E45]"
                  >
                    Ubah PIN
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisablingPin((v) => !v)}
                    className="min-h-[40px] rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25"
                  >
                    Nonaktifkan PIN
                  </button>
                </div>

                {disablingPin ? (
                  <form
                    onSubmit={handleDisablePin}
                    className="space-y-3 rounded-xl border border-rose-200/80 bg-rose-50/60 p-3.5 dark:border-rose-500/30 dark:bg-rose-950/20"
                  >
                    <div className="space-y-1">
                      <label
                        htmlFor="disable-pin-password"
                        className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
                      >
                        Kata Sandi Owner Saat Ini
                      </label>
                      <input
                        id="disable-pin-password"
                        type="password"
                        value={disablePinPassword}
                        onChange={(e) => setDisablePinPassword(e.target.value)}
                        autoComplete="current-password"
                        placeholder="Verifikasi kata sandi Anda"
                        className="w-full rounded-xl border border-[#DCE4F0] bg-white px-3 py-2 text-sm text-[#06132F] focus:border-[#087BFF] focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={disablePin.isPending}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                      >
                        {disablePin.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : null}
                        <span>Konfirmasi Nonaktifkan PIN</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDisablingPin(false);
                          setDisablePinPassword("");
                        }}
                        className="min-h-[40px] rounded-xl border border-[#DCE4F0] bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-[#1B3163] dark:bg-[#091634] dark:text-[#C7D0E0]"
                      >
                        Batal
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            ) : (
              <form
                onSubmit={handleSavePin}
                className="mt-4 space-y-3.5 border-t border-[#DCE4F0] pt-4 dark:border-[#1B3163]"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label
                      htmlFor="pin-input"
                      className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
                    >
                      PIN 6 Digit
                    </label>
                    <input
                      id="pin-input"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="off"
                      value={pinValue}
                      onChange={(e) =>
                        setPinValue(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder="••••••"
                      className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 font-mono text-sm tracking-widest text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="pin-confirm-input"
                      className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
                    >
                      Konfirmasi PIN
                    </label>
                    <input
                      id="pin-confirm-input"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="off"
                      value={pinConfirm}
                      onChange={(e) =>
                        setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder="••••••"
                      className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 font-mono text-sm tracking-widest text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="pin-owner-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
                  >
                    Kata Sandi Owner Saat Ini
                  </label>
                  <input
                    id="pin-owner-password"
                    type="password"
                    autoComplete="current-password"
                    value={pinPassword}
                    onChange={(e) => setPinPassword(e.target.value)}
                    placeholder="Wajib diisi untuk verifikasi pemilik"
                    className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={setupPin.isPending}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:brightness-110 disabled:opacity-60"
                  >
                    {setupPin.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>{auth?.hasPin ? "Simpan PIN Baru" : "Aktifkan Kunci PIN"}</span>
                  </button>
                  {editingPin ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPin(false);
                        setPinValue("");
                        setPinConfirm("");
                        setPinPassword("");
                      }}
                      className="min-h-[42px] rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]"
                    >
                      Batal
                    </button>
                  ) : null}
                </div>
              </form>
            )}
          </div>

          {/* Diagnostik & Supabase */}
          <div className="rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-[#06132F] dark:text-white">
                Status Diagnostik &amp; Kesiapan Cloud
              </h2>
              <button
                type="button"
                onClick={handleResync}
                disabled={isFetching}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3 py-1.5 text-xs font-semibold text-[#06132F] transition-colors hover:border-[#087BFF]/40 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0] dark:hover:border-[#19D8FF]/40"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                <span>Sinkronkan Ulang</span>
              </button>
            </div>

            <ul className="mt-4 divide-y divide-[#DCE4F0]/80 dark:divide-[#1B3163]">
              {diagnostics.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 text-xs"
                >
                  <span className="text-slate-500 dark:text-[#C7D0E0]/75">
                    {item.label}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#087BFF] dark:text-[#19D8FF]">
                    <CheckCircle2
                      className="h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{item.status}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3.5 text-xs text-slate-600 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]/80">
              <div className="flex items-center gap-2 font-semibold text-[#06132F] dark:text-white">
                <Database
                  className="h-3.5 w-3.5 text-[#087BFF] dark:text-[#19D8FF]"
                  aria-hidden="true"
                />
                <span>Status Supabase Cloud</span>
              </div>
              <p className="mt-1.5 leading-relaxed">
                {isSupabaseConfigured
                  ? "Supabase Cloud sudah terhubung aktif. Seluruh mutasi Anda dilindungi RLS owner_id = auth.uid()."
                  : "Untuk penyimpanan cloud permanen: (1) Jalankan skrip docs/ego-supabase-setup.sql di Supabase SQL Editor, lalu (2) Isi VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY pada panel Secrets sebelum mempublikasikan."}
              </p>
            </div>
          </div>

          {/* Instalasi Ponsel PWA */}
          <div className="rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
                <Smartphone className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#06132F] dark:text-white">
                  Aplikasi Harian di Ponsel (PWA)
                </h2>
                <p className="text-xs text-slate-600 dark:text-[#C7D0E0]/75">
                  {isInstalled
                    ? "Aplikasi sudah berjalan dalam mode layar penuh (standalone)."
                    : "Pasang di layar utama iPhone atau Android agar terasa seperti aplikasi native."}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <PWAInstallButton />
              {!isInstalled ? (
                <p className="mt-2.5 text-xs leading-relaxed text-slate-500 dark:text-[#C7D0E0]/70">
                  Di iPhone Safari, ketuk tombol Bagikan lalu &ldquo;Tambahkan ke Layar Utama&rdquo;. Di Android Chrome/Edge, gunakan tombol Pasang Aplikasi di atas.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {/* Preferensi, Ekspor/Backup, Sandi & Logout */}
        <section className="space-y-6 lg:col-span-6">
          <form
            onSubmit={handleSavePrefs}
            className="space-y-5 rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-6"
          >
            <h2 className="text-base font-bold text-[#06132F] dark:text-white">
              Preferensi Tampilan &amp; Batas Pengeluaran
            </h2>

            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]">
                Tampilan &amp; Tema Aplikasi
              </span>
              <div className="flex flex-col gap-2 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3.5 dark:border-[#1B3163] dark:bg-[#06132F] sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-600 dark:text-[#C7D0E0]/75">
                  Pilih mode terang profesional atau Midnight Navy gelap.
                </p>
                <ThemeToggleButton className="shrink-0" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="pref-date-format"
                className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
              >
                Format Tanggal
              </label>
              <select
                id="pref-date-format"
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value as DateFormatPref)}
                className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
              >
                <option value="DD MMM YYYY">DD MMM YYYY (23 Nov 2026)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (23/11/2026)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (2026-11-23)</option>
              </select>
            </div>

            <MoneyInput
              id="pref-expense-limit"
              label="Batas Peringatan Pengeluaran Harian (IDR)"
              value={expenseLimit}
              onChange={setExpenseLimit}
              hint="Menampilkan peringatan lembut saat mencatat pengeluaran sebesar atau di atas batas ini."
            />

            <button
              type="submit"
              disabled={updatePrefs.isPending}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:brightness-110 disabled:opacity-60"
            >
              {updatePrefs.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              <span>Simpan Preferensi</span>
            </button>
          </form>

          {/* Ekspor & Cadangan Brankas */}
          <div className="rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-6">
            <h2 className="text-base font-bold text-[#06132F] dark:text-white">
              Ekspor &amp; Cadangan Data Brankas
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-[#C7D0E0]/75">
              Unduh salinan pribadi laporan transaksi untuk Excel/Sheets (CSV) atau arsip lengkap seluruh brankas (JSON) kapan saja.
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={!vault}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-4 py-2.5 text-xs font-semibold text-[#06132F] transition-colors hover:border-[#087BFF]/40 disabled:opacity-50 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]"
              >
                <FileSpreadsheet className="h-4 w-4 text-[#087BFF] dark:text-[#19D8FF]" aria-hidden="true" />
                <span>Ekspor Transaksi (CSV)</span>
              </button>
              <button
                type="button"
                onClick={handleExportJsonBackup}
                disabled={!vault}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-[#087BFF]/30 bg-[#087BFF]/10 px-4 py-2.5 text-xs font-semibold text-[#087BFF] transition-colors hover:bg-[#087BFF]/15 disabled:opacity-50 dark:border-[#19D8FF]/30 dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Cadangan Brankas Lengkap (JSON)</span>
              </button>
            </div>
          </div>

          {/* Ganti Kata Sandi Brankas */}
          <form
            onSubmit={handleChangePassword}
            className="space-y-4 rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-6"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
                <KeyRound className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#06132F] dark:text-white">
                  Ganti Kata Sandi Brankas
                </h2>
                <p className="text-xs text-slate-600 dark:text-[#C7D0E0]/75">
                  Memperbarui kata sandi akan memutus seluruh sesi perangkat lain secara otomatis.
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="current-vault-password"
                className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
              >
                Kata Sandi Saat Ini
              </label>
              <input
                id="current-vault-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Masukkan kata sandi aktif Anda"
                className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label
                  htmlFor="new-vault-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
                >
                  Kata Sandi Baru (Min. 6 karakter)
                </label>
                <input
                  id="new-vault-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="confirm-new-vault-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
                >
                  Konfirmasi Kata Sandi Baru
                </label>
                <input
                  id="confirm-new-vault-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Ketik ulang kata sandi baru"
                  className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={changePassword.isPending}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:brightness-110 disabled:opacity-60"
            >
              {changePassword.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>Perbarui Kata Sandi</span>
            </button>
          </form>

          {/* Kontrol Sesi */}
          <div className="rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-6">
            <h2 className="text-base font-bold text-[#06132F] dark:text-white">
              Kontrol Sesi Brankas
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-[#C7D0E0]/75">
              Menutup sesi akan membersihkan seluruh cache data lokal di browser dan mengunci kembali brankas pribadi Anda.
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleLogout}
                disabled={logout.isPending}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>Kunci Brankas &amp; Bersihkan Cache Sesi</span>
              </button>

              {!isSupabaseConfigured ? (
                <button
                  type="button"
                  onClick={() => setDeletingOwner((v) => !v)}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0] dark:hover:border-rose-500/40 dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span>Hapus Akun Owner</span>
                </button>
              ) : null}
            </div>

            {!isSupabaseConfigured && deletingOwner ? (
              <form
                onSubmit={handleDeleteOwner}
                className="mt-4 space-y-3 rounded-xl border border-rose-200/90 bg-rose-50/70 p-4 dark:border-rose-500/30 dark:bg-rose-950/20"
              >
                <p className="text-xs leading-relaxed text-rose-900 dark:text-rose-200">
                  Menghapus akun Owner akan mengosongkan seluruh data brankas lokal (akun, transaksi, aset, utang, dan rencana) dan membuka kembali pendaftaran Owner baru.
                </p>
                <label className="flex cursor-pointer items-start gap-2.5 text-xs text-[#06132F] dark:text-[#C7D0E0]">
                  <input
                    type="checkbox"
                    checked={deleteOwnerConfirmed}
                    onChange={(e) => setDeleteOwnerConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-rose-300 accent-rose-600"
                  />
                  <span>
                    Saya memahami seluruh data brankas lokal akan dihapus permanen.
                  </span>
                </label>
                <div className="space-y-1">
                  <label
                    htmlFor="delete-owner-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
                  >
                    Kata Sandi Owner Saat Ini
                  </label>
                  <input
                    id="delete-owner-password"
                    type="password"
                    autoComplete="current-password"
                    value={deleteOwnerPassword}
                    onChange={(e) => setDeleteOwnerPassword(e.target.value)}
                    placeholder="Verifikasi kata sandi Anda"
                    className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-[#06132F] focus:border-rose-500 focus:outline-none dark:border-rose-500/30 dark:bg-[#06132F] dark:text-white"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={deleteOwner.isPending}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                  >
                    {deleteOwner.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>Konfirmasi Hapus Akun Owner</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeletingOwner(false);
                      setDeleteOwnerPassword("");
                      setDeleteOwnerConfirmed(false);
                    }}
                    className="min-h-[40px] rounded-xl border border-[#DCE4F0] bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-[#1B3163] dark:bg-[#091634] dark:text-[#C7D0E0]"
                  >
                    Batal
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
