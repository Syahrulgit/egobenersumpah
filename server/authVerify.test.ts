import test from "node:test";
import assert from "node:assert/strict";
import { getPublicSupabaseConfig, isPublicSupabaseKey } from "./authVerify";

function withEnv(vars: Record<string, string | undefined>, fn: () => void): void {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    prev[key] = process.env[key];
    if (vars[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = vars[key];
    }
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(prev)) {
      if (prev[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = prev[key];
      }
    }
  }
}

function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

test("getPublicSupabaseConfig returns public URL and valid publishable key without secret keys", () => {
  withEnv(
    {
      VITE_SUPABASE_URL: "https://example.supabase.co/rest/v1",
      SUPABASE_URL: undefined,
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo_public_key_123456",
      SUPABASE_PUBLISHABLE_KEY: undefined,
      VITE_SUPABASE_ANON_KEY: undefined,
      SUPABASE_ANON_KEY: undefined,
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_should_never_leak",
    },
    () => {
      const cfg = getPublicSupabaseConfig();
      assert.deepEqual(cfg, {
        supabaseConfigured: true,
        url: "https://example.supabase.co",
        publishableKey: "sb_publishable_demo_public_key_123456",
      });
      assert.equal(JSON.stringify(cfg).includes("should_never_leak"), false);
    }
  );
});

test("isPublicSupabaseKey rejects project ref strings, service_role JWTs, and sb_secret_ keys", () => {
  const serviceRoleJwt = makeFakeJwt({ role: "service_role", iss: "supabase" });
  const anonJwt = makeFakeJwt({ role: "anon", iss: "supabase" });

  assert.equal(isPublicSupabaseKey("teudnrqmadbrxpguoqug"), false);
  assert.equal(isPublicSupabaseKey("sb_secret_forbidden_123456789"), false);
  assert.equal(isPublicSupabaseKey(serviceRoleJwt), false);
  assert.equal(isPublicSupabaseKey(anonJwt), true);
  assert.equal(isPublicSupabaseKey("sb_publishable_I5JUiEHza_jeTp-Q3Vqazw_8a2PAgT0"), true);
});

test("getPublicSupabaseConfig skips malformed env values and falls back to valid runtime anon JWT", () => {
  const anonJwt = makeFakeJwt({ role: "anon", iss: "supabase" });
  withEnv(
    {
      VITE_SUPABASE_URL: "",
      SUPABASE_URL: "https://runtime.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "teudnrqmadbrxpguoqug",
      SUPABASE_PUBLISHABLE_KEY: "",
      VITE_SUPABASE_ANON_KEY: "",
      SUPABASE_ANON_KEY: anonJwt,
    },
    () => {
      const cfg = getPublicSupabaseConfig();
      assert.deepEqual(cfg, {
        supabaseConfigured: true,
        url: "https://runtime.supabase.co",
        publishableKey: anonJwt,
      });
    }
  );
});
