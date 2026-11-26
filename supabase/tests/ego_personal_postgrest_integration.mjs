import { createHmac } from "node:crypto";

const baseUrl = process.env.EGO_POSTGREST_URL ?? "http://127.0.0.1:3000";
const secret = process.env.EGO_TEST_JWT_SECRET;
if (!secret) throw new Error("EGO_TEST_JWT_SECRET is required");

const ownerA = "11111111-1111-4111-8111-111111111111";
const ownerB = "22222222-2222-4222-8222-222222222222";
const accountA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const txId = "41414141-4141-4141-8141-414141414141";

function token(role, sub) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ role, ...(sub ? { sub } : {}), iat: now, exp: now + 300 });
  const unsigned = header + "." + payload;
  const signature = createHmac("sha256", secret).update(unsigned).digest("base64url");
  return unsigned + "." + signature;
}

async function request(path, { role = "anon", sub, method = "GET", body } = {}) {
  const headers = { Authorization: "Bearer " + token(role, sub), Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(baseUrl + path, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function assert(condition, message) {
  if (!condition) throw new Error("ASSERTION FAILED: " + message);
  console.log("PASS " + message);
}

const ownerAAccounts = await request("/accounts?select=id,owner_id", { role: "authenticated", sub: ownerA });
assert(ownerAAccounts.status === 200, "authenticated Owner can query accounts through PostgREST");
const aRows = await ownerAAccounts.json();
assert(aRows.length === 3 && aRows.every((row) => row.owner_id === ownerA),
  "RLS returns only Owner A rows");

const ownerBAccounts = await request("/accounts?select=id,owner_id", { role: "authenticated", sub: ownerB });
assert(ownerBAccounts.status === 200, "second authenticated Owner can query accounts");
const bRows = await ownerBAccounts.json();
assert(bRows.length === 1 && bRows[0].owner_id === ownerB,
  "RLS isolates Owner B rows from Owner A");

const create = await request("/rpc/create_confirmed_transaction", {
  role: "authenticated",
  sub: ownerA,
  method: "POST",
  body: {
    p_id: txId,
    p_transaction_type: "expense",
    p_source_account_id: accountA,
    p_destination_account_id: null,
    p_amount: 12.5,
    p_transaction_date: "2026-11-27",
    p_category: "Integrasi API",
    p_description: "Uji PostgREST",
    p_owner_confirmed: true,
  },
});
assert(create.status === 200 || create.status === 201,
  "authenticated Owner can invoke confirmed transaction RPC over HTTP");
const created = await create.json();
assert(Array.isArray(created) ? created[0]?.id === txId : created?.id === txId,
  "RPC response contains the expected transaction id");

const unconfirmed = await request("/rpc/create_confirmed_transaction", {
  role: "authenticated",
  sub: ownerA,
  method: "POST",
  body: {
    p_id: "42424242-4242-4242-8242-424242424242",
    p_transaction_type: "expense",
    p_source_account_id: accountA,
    p_destination_account_id: null,
    p_amount: 1,
    p_transaction_date: "2026-11-27",
    p_category: "Uji",
    p_description: "Tanpa persetujuan",
    p_owner_confirmed: false,
  },
});
assert(unconfirmed.status >= 400, "RPC rejects a transaction without explicit Owner confirmation");

const crossOwnerCancel = await request("/rpc/cancel_confirmed_transaction", {
  role: "authenticated",
  sub: ownerB,
  method: "POST",
  body: { p_id: txId },
});
assert(crossOwnerCancel.status >= 400, "Owner B cannot cancel Owner A transaction");

const anonRpc = await request("/rpc/create_confirmed_transaction", {
  role: "anon",
  method: "POST",
  body: {
    p_id: "43434343-4343-4343-8343-434343434343",
    p_transaction_type: "expense",
    p_source_account_id: accountA,
    p_destination_account_id: null,
    p_amount: 1,
    p_transaction_date: "2026-11-27",
    p_category: "Uji",
    p_description: "Anon",
    p_owner_confirmed: true,
  },
});
assert(anonRpc.status >= 400, "anonymous role cannot execute finance RPC");

const directInsert = await request("/transactions", {
  role: "authenticated",
  sub: ownerA,
  method: "POST",
  body: {
    transaction_type: "expense",
    source_account_id: accountA,
    destination_account_id: null,
    amount: 1,
    transaction_date: "2026-11-27",
    category: "Bypass",
    status: "posted",
    owner_confirmed: true,
  },
});
assert(directInsert.status >= 400, "direct ledger INSERT is denied through Data API");

const invalidJwt = await fetch(baseUrl + "/accounts?select=id", {
  headers: { Authorization: "Bearer invalid.jwt.token" },
});
assert(invalidJwt.status === 401, "invalid JWT is rejected by PostgREST");

console.log("PostgREST EGO-PERSONAL integration checks passed.");
