const RECOVERY_STORAGE_KEY = "ego_password_recovery_active";
const RECOVERY_CHANGE_EVENT = "ego-password-recovery-change";

let memoryRecoveryActive = false;
const listeners = new Set<() => void>();

export const PASSWORD_RESET_NEUTRAL_NOTICE =
  "Jika email tersebut terdaftar di sistem EGO, tautan pemulihan kata sandi telah dikirim. Silakan periksa kotak masuk atau folder spam Anda.";

export function isRecoveryRedirectUrl(urlLike: string): boolean {
  try {
    const parsed = new URL(urlLike, "http://localhost");
    const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
    const hasError =
      parsed.searchParams.has("error") ||
      parsed.searchParams.has("error_code") ||
      hashParams.has("error") ||
      hashParams.has("error_code");
    if (hasError) {
      return false;
    }
    return (
      hashParams.get("type") === "recovery" ||
      parsed.searchParams.get("type") === "recovery"
    );
  } catch {
    return false;
  }
}

export function parseAuthRedirectError(urlLike: string): string | null {
  try {
    const parsed = new URL(urlLike, "http://localhost");
    const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
    const error = parsed.searchParams.get("error") || hashParams.get("error") || "";
    const errorCode =
      parsed.searchParams.get("error_code") || hashParams.get("error_code") || "";
    const description = (
      parsed.searchParams.get("error_description") ||
      hashParams.get("error_description") ||
      ""
    ).toLowerCase();

    if (!error && !errorCode && !description) {
      return null;
    }

    if (
      errorCode === "otp_expired" ||
      description.includes("expired") ||
      description.includes("invalid")
    ) {
      return "Tautan pemulihan tidak valid atau sudah kedaluwarsa. Silakan kirim ulang tautan pemulihan.";
    }

    return "Tautan pemulihan tidak dapat diproses atau sudah tidak berlaku. Silakan kirim ulang tautan pemulihan.";
  } catch {
    return null;
  }
}

export function validateRecoveryPasswordInput(
  newPassword: string,
  confirmPassword: string
): { valid: true } | { valid: false; message: string } {
  if (!newPassword) {
    return { valid: false, message: "Kata sandi baru wajib diisi." };
  }
  if (!newPassword.trim()) {
    return {
      valid: false,
      message: "Kata sandi baru tidak boleh hanya berisi spasi.",
    };
  }
  if (newPassword.length < 6) {
    return { valid: false, message: "Kata sandi baru minimal 6 karakter." };
  }
  if (newPassword.length > 128) {
    return { valid: false, message: "Kata sandi baru maksimal 128 karakter." };
  }
  if (newPassword !== confirmPassword) {
    return {
      valid: false,
      message: "Konfirmasi kata sandi tidak cocok dengan kata sandi baru.",
    };
  }
  return { valid: true };
}

export function classifyPasswordResetError(err: unknown): {
  kind: "neutral_success" | "rate_limit" | "error";
  message: string;
} {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message?: unknown }).message ?? "")
        : String(err ?? "");
  const lower = raw.toLowerCase();

  if (
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("security purposes") ||
    lower.includes("over_email_send_rate_limit")
  ) {
    return {
      kind: "rate_limit",
      message:
        "Permintaan pemulihan terlalu sering. Silakan tunggu beberapa saat sebelum mencoba lagi.",
    };
  }

  // Never disclose whether an email address is registered in Supabase.
  if (
    lower.includes("user not found") ||
    lower.includes("email not confirmed") ||
    lower.includes("signups not allowed") ||
    lower.includes("invalid login")
  ) {
    return {
      kind: "neutral_success",
      message: PASSWORD_RESET_NEUTRAL_NOTICE,
    };
  }

  if (
    lower.includes("redirect") &&
    (lower.includes("not allowed") || lower.includes("invalid"))
  ) {
    return {
      kind: "error",
      message:
        "Alamat redirect /auth belum diizinkan pada konfigurasi Supabase Auth Redirect URLs.",
    };
  }

  if (
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("timeout")
  ) {
    return {
      kind: "error",
      message:
        "Tidak dapat terhubung ke layanan pemulihan saat ini. Periksa koneksi internet Anda lalu coba lagi.",
    };
  }

  // Default to a safe technical message without echoing provider details that could hint user state
  return {
    kind: "error",
    message:
      "Permintaan pemulihan belum dapat diproses saat ini. Silakan coba lagi beberapa saat lagi.",
  };
}

export function formatPasswordUpdateError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message?: unknown }).message ?? "")
        : String(err ?? "");
  const lower = raw.toLowerCase();

  if (
    lower.includes("different from the old password") ||
    lower.includes("same password")
  ) {
    return "Kata sandi baru harus berbeda dari kata sandi sebelumnya.";
  }

  if (
    lower.includes("session") ||
    lower.includes("expired") ||
    lower.includes("jwt") ||
    lower.includes("not authenticated")
  ) {
    return "Sesi pemulihan telah berakhir atau tidak valid. Silakan kirim ulang tautan pemulihan.";
  }

  if (lower.includes("at least 6") || lower.includes("weak")) {
    return "Kata sandi baru minimal 6 karakter dan harus memenuhi standar keamanan.";
  }

  return raw || "Gagal memperbarui kata sandi baru. Silakan coba lagi.";
}

function emitRecoveryChange(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Ignore subscriber error
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(RECOVERY_CHANGE_EVENT));
  }
}

export function isPasswordRecoveryActive(): boolean {
  if (memoryRecoveryActive) return true;
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(RECOVERY_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setPasswordRecoveryActive(active: boolean): void {
  const changed = memoryRecoveryActive !== active;
  memoryRecoveryActive = active;
  if (typeof window !== "undefined") {
    try {
      if (active) {
        window.sessionStorage.setItem(RECOVERY_STORAGE_KEY, "1");
      } else {
        window.sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
      }
    } catch {
      // Ignore storage error
    }
  }
  if (changed || active) {
    emitRecoveryChange();
  } else {
    emitRecoveryChange();
  }
}

export function initRecoveryStateFromLocation(): void {
  if (typeof window === "undefined") return;
  if (isRecoveryRedirectUrl(window.location.href)) {
    setPasswordRecoveryActive(true);
  }
}

export function subscribePasswordRecoveryChange(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener(RECOVERY_CHANGE_EVENT, listener);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener(RECOVERY_CHANGE_EVENT, listener);
    }
  };
}
