const authUrl = process.env.EGO_GOTRUE_URL ?? "http://127.0.0.1:9999";
const postgrestUrl = process.env.EGO_POSTGREST_URL ?? "http://127.0.0.1:3000";
const email = "ego-gotrue-owner@example.test";
const password = "Ego-Test-Only-Password-2026!";

function assert(condition, message) {
  if (!condition) throw new Error("ASSERTION FAILED: " + message);
  console.log("PASS " + message);
}

async function jsonRequest(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
  return { response, data };
}

// Create a disposable account through the real GoTrue signup endpoint.
const signup = await jsonRequest(authUrl + "/signup", {
  email,
  password,
  data: { test_scope: "isolated-ego-personal-auth" },
});
assert(
  signup.response.status === 200 || signup.response.status === 201,
  "GoTrue accepts a disposable email signup"
);
assert(typeof signup.data.id === "string", "GoTrue returns a persisted user id");

// Authenticate through the password grant; do not synthesize or modify the JWT.
const login = await jsonRequest(authUrl + "/token?grant_type=password", {
  email,
  password,
});
assert(login.response.status === 200, "GoTrue password login succeeds");
assert(typeof login.data.access_token === "string", "GoTrue issues an access token");
assert(login.data.token_type?.toLowerCase() === "bearer", "GoTrue identifies the token as Bearer");

const parts = login.data.access_token.split(".");
assert(parts.length === 3, "issued access token has JWT structure");
const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
assert(claims.sub === signup.data.id, "JWT subject matches the created GoTrue user");
assert(claims.role === "authenticated", "GoTrue JWT carries authenticated role");
assert(claims.aud === "authenticated" || claims.aud?.includes?.("authenticated"),
  "GoTrue JWT carries the expected authenticated audience");

// Send the actual GoTrue-issued token to the isolated EGO-PERSONAL PostgREST API.
const apiResponse = await fetch(postgrestUrl + "/accounts?select=id,owner_id", {
  headers: {
    Authorization: "Bearer " + login.data.access_token,
    Accept: "application/json",
  },
});
assert(apiResponse.status === 200,
  "PostgREST accepts the real GoTrue-issued JWT");
const rows = await apiResponse.json();
assert(Array.isArray(rows) && rows.length === 0,
  "RLS returns no EGO-PERSONAL rows for a newly registered, unseeded test identity");

const badLogin = await jsonRequest(authUrl + "/token?grant_type=password", {
  email,
  password: "incorrect-password",
});
assert(badLogin.response.status >= 400,
  "GoTrue rejects an incorrect password");

console.log("GoTrue-to-PostgREST EGO-PERSONAL auth integration checks passed.");
