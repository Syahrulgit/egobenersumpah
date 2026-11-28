import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyPasswordResetError,
  formatPasswordUpdateError,
  getPasswordRecoveryRedirectUrl,
  isRecoveryRedirectUrl,
  parseAuthRedirectError,
  parseRecoveryCallbackParams,
  PASSWORD_RESET_NEUTRAL_NOTICE,
  PRODUCTION_AUTH_REDIRECT_URL,
  validateRecoveryPasswordInput,
} from "./auth-recovery";

test("getPasswordRecoveryRedirectUrl always returns explicit production /auth URL without localhost", () => {
  const redirectUrl = getPasswordRecoveryRedirectUrl();
  assert.equal(redirectUrl, "https://ego-personal-ai.ai.studio/auth");
  assert.equal(redirectUrl, PRODUCTION_AUTH_REDIRECT_URL);
  assert.equal(redirectUrl.includes("localhost"), false);
  assert.equal(redirectUrl.includes("127.0.0.1"), false);
});

test("parseRecoveryCallbackParams extracts implicit hash tokens, PKCE code, token_hash, and errors", () => {
  const implicit = parseRecoveryCallbackParams(
    "https://ego-personal-ai.ai.studio/auth#access_token=tok_123&refresh_token=ref_456&type=recovery"
  );
  assert.deepEqual(implicit, {
    isRecoveryType: true,
    hasAccessToken: true,
    code: null,
    tokenHash: null,
    errorMessage: null,
  });

  const tokenHash = parseRecoveryCallbackParams(
    "https://ego-personal-ai.ai.studio/auth?token_hash=hash_abc&type=recovery"
  );
  assert.deepEqual(tokenHash, {
    isRecoveryType: true,
    hasAccessToken: false,
    code: null,
    tokenHash: "hash_abc",
    errorMessage: null,
  });

  const pkce = parseRecoveryCallbackParams(
    "https://ego-personal-ai.ai.studio/auth?code=pkce_xyz"
  );
  assert.deepEqual(pkce, {
    isRecoveryType: false,
    hasAccessToken: false,
    code: "pkce_xyz",
    tokenHash: null,
    errorMessage: null,
  });
});

test("isRecoveryRedirectUrl detects recovery links from hash or query and ignores error redirects", () => {
  assert.equal(
    isRecoveryRedirectUrl(
      "https://ego-personal-ai.ai.studio/auth#access_token=abc&refresh_token=def&type=recovery"
    ),
    true
  );
  assert.equal(
    isRecoveryRedirectUrl("https://ego-personal-ai.ai.studio/auth?type=recovery&code=123"),
    true
  );
  assert.equal(
    isRecoveryRedirectUrl("https://ego-personal-ai.ai.studio/auth#access_token=abc&type=signup"),
    false
  );
  assert.equal(
    isRecoveryRedirectUrl(
      "https://ego-personal-ai.ai.studio/auth#error=access_denied&error_code=otp_expired&type=recovery"
    ),
    false
  );
});

test("parseAuthRedirectError translates expired and invalid recovery redirect errors", () => {
  assert.match(
    parseAuthRedirectError(
      "https://ego-personal-ai.ai.studio/auth#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"
    ) ?? "",
    /kedaluwarsa/i
  );
  assert.equal(parseAuthRedirectError("https://ego-personal-ai.ai.studio/auth"), null);
});

test("validateRecoveryPasswordInput enforces 6+ chars, non-whitespace, and confirmation match", () => {
  assert.deepEqual(validateRecoveryPasswordInput("", ""), {
    valid: false,
    message: "Kata sandi baru wajib diisi.",
  });
  assert.deepEqual(validateRecoveryPasswordInput("      ", "      "), {
    valid: false,
    message: "Kata sandi baru tidak boleh hanya berisi spasi.",
  });
  assert.deepEqual(validateRecoveryPasswordInput("12345", "12345"), {
    valid: false,
    message: "Kata sandi baru minimal 6 karakter.",
  });
  assert.deepEqual(validateRecoveryPasswordInput("secret123", "secret124"), {
    valid: false,
    message: "Konfirmasi kata sandi tidak cocok dengan kata sandi baru.",
  });
  assert.deepEqual(validateRecoveryPasswordInput("secret123", "secret123"), {
    valid: true,
  });
});

test("classifyPasswordResetError prevents email enumeration while handling rate limits", () => {
  assert.deepEqual(classifyPasswordResetError(new Error("User not found")), {
    kind: "neutral_success",
    message: PASSWORD_RESET_NEUTRAL_NOTICE,
  });
  assert.equal(
    classifyPasswordResetError(
      new Error("For security purposes, you can only request this after 60 seconds.")
    ).kind,
    "rate_limit"
  );
  assert.equal(
    classifyPasswordResetError(new Error("Failed to fetch")).kind,
    "error"
  );
});

test("formatPasswordUpdateError returns Indonesian error messages for common updateUser failures", () => {
  assert.match(
    formatPasswordUpdateError(new Error("New password should be different from the old password.")),
    /berbeda dari kata sandi sebelumnya/i
  );
  assert.match(
    formatPasswordUpdateError(new Error("Auth session missing!")),
    /Sesi pemulihan telah berakhir/i
  );
});
