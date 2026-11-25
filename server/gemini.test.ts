import assert from "node:assert/strict";
import test from "node:test";
import { classifyGeminiError, withGeminiRetryAndFallback } from "./gemini";

test("classifyGeminiError maps 429 RESOURCE_EXHAUSTED raw JSON into clean Indonesian quota error", () => {
  const raw = new Error(
    JSON.stringify({
      error: {
        code: 429,
        message: "You exceeded your current quota, please check your plan and billing details.",
        status: "RESOURCE_EXHAUSTED",
      },
    })
  );

  const classified = classifyGeminiError(raw);
  assert.equal(classified.statusCode, 429);
  assert.equal(classified.code, "QUOTA_EXCEEDED");
  assert.equal(classified.message.includes("RESOURCE_EXHAUSTED"), false);
  assert.equal(classified.message.includes("Kuota"), true);
});

test("withGeminiRetryAndFallback retries primary and switches to fallback model on 429", async () => {
  const calls: string[] = [];
  const result = await withGeminiRetryAndFallback(
    ["gemini-4-hydrogen", "gemini-3.1-flash-lite"],
    async (model) => {
      calls.push(model);
      if (model === "gemini-4-hydrogen") {
        throw new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}');
      }
      return `ok-from-${model}`;
    },
    1
  );

  assert.equal(result, "ok-from-gemini-3.1-flash-lite");
  assert.deepEqual(calls, [
    "gemini-4-hydrogen",
    "gemini-4-hydrogen",
    "gemini-3.1-flash-lite",
  ]);
});

test("withGeminiRetryAndFallback fails immediately without fallback on AUTH_ERROR", async () => {
  const calls: string[] = [];
  await assert.rejects(
    () =>
      withGeminiRetryAndFallback(
        ["gemini-4-hydrogen", "gemini-3.1-flash-lite"],
        async (model) => {
          calls.push(model);
          throw new Error("API_KEY_INVALID");
        },
        1
      ),
    (err: unknown) =>
      err instanceof Error &&
      "code" in err &&
      (err as { code?: string }).code === "AUTH_ERROR"
  );
  assert.deepEqual(calls, ["gemini-4-hydrogen"]);
});
