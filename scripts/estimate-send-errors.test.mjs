import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const http = await import(join(root, "src/lib/auth/resend-http.ts"));
const guard = await import(join(root, "src/lib/housefile/estimate-send.ts"));

const KEY = "re_testkey_abcdefghijklmnop";

function mockFetch(responses) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)];
    if (next instanceof Error) throw next;
    return new Response(next.body, { status: next.status });
  };
  return { fn, calls };
}

function quiet(fn) {
  const { error, warn } = console;
  console.error = () => {};
  console.warn = () => {};
  return Promise.resolve(fn()).finally(() => {
    console.error = error;
    console.warn = warn;
  });
}

test("thrown send error includes HTTP status and truncated body, never the key", async () => {
  const body = JSON.stringify({
    statusCode: 400,
    message: `The associated domain with your API key is not verified. key=${KEY} ${"x".repeat(900)}`,
  });
  const { fn } = mockFetch([{ status: 400, body }]);
  await quiet(async () => {
    const err = await http
      .postResendEmail({ key: KEY, payload: {}, idempotencyKey: "k1", fetchImpl: fn, retryDelayMs: 0 })
      .catch((e) => e);
    assert.ok(err instanceof http.ResendSendError);
    assert.equal(err.status, 400);
    assert.match(err.message, /HTTP 400/);
    assert.match(err.message, /associated domain with your API key is not verified/);
    assert.ok(!err.message.includes(KEY));
    assert.ok(err.body.length <= 501);
    assert.equal(http.sendFailureReason(err), "the mail key is not allowed to send from this domain");
  });
});

test("re-sending an already-sent proposal is allowed with the resend flag", () => {
  assert.doesNotThrow(() => guard.assertEstimateSendable("sent", true));
  assert.throws(() => guard.assertEstimateSendable("sent", false), /Re-send estimate/);
  assert.throws(() => guard.assertEstimateSendable("pending", true), /approve/);
  assert.doesNotThrow(() => guard.assertEstimateSendable("draft", false));
  assert.deepEqual(guard.parseEstimateSendInput({ proposalId: "p1", resend: true, attemptId: "attempt-0001" }), {
    proposalId: "p1",
    resend: true,
    attemptId: "attempt-0001",
  });
  assert.deepEqual(guard.parseEstimateSendInput("p1"), { proposalId: "p1", resend: false, attemptId: null });
});

test("re-send of a sent proposal posts again and succeeds", async () => {
  const { fn, calls } = mockFetch([
    { status: 200, body: '{"id":"first"}' },
    { status: 200, body: '{"id":"second"}' },
  ]);
  const scope = guard.estimateIdempotencyScope("b1380dad");
  const first = await http.postResendEmail({ key: KEY, payload: {}, idempotencyKey: http.newIdempotencyKey(scope), fetchImpl: fn });
  guard.assertEstimateSendable("sent", true);
  const again = await http.postResendEmail({ key: KEY, payload: {}, idempotencyKey: http.newIdempotencyKey(scope), fetchImpl: fn });
  assert.equal(first.id, "first");
  assert.equal(again.id, "second");
  assert.equal(calls.length, 2);
});

test("each send attempt uses a different Idempotency-Key; retries reuse it", async () => {
  const { fn, calls } = mockFetch([
    { status: 500, body: "boom" },
    { status: 200, body: '{"id":"a"}' },
    { status: 200, body: '{"id":"b"}' },
  ]);
  const scope = guard.estimateIdempotencyScope("p1");
  await quiet(() =>
    http.postResendEmail({ key: KEY, payload: {}, idempotencyKey: http.newIdempotencyKey(scope), fetchImpl: fn, retryDelayMs: 0 }),
  );
  await http.postResendEmail({ key: KEY, payload: {}, idempotencyKey: http.newIdempotencyKey(scope), fetchImpl: fn });
  const keys = calls.map((c) => c.init.headers["Idempotency-Key"]);
  assert.equal(keys.length, 3);
  assert.equal(keys[0], keys[1], "retry of the same attempt reuses its key");
  assert.notEqual(keys[1], keys[2], "a new attempt gets a new key");
  assert.ok(keys.every((k) => k.startsWith("estimate/p1/")));
  assert.equal(http.newIdempotencyKey(scope, "attempt-0001"), http.newIdempotencyKey(scope, "attempt-0001"));
});

test("401 restricted_api_key on status calls is swallowed", async () => {
  const body = '{"statusCode":401,"message":"This API key is restricted to only send emails","name":"restricted_api_key"}';
  const { fn } = mockFetch([{ status: 401, body }]);
  const warnings = [];
  const { warn } = console;
  console.warn = (m) => warnings.push(m);
  try {
    const got = await http.getResendJson({ key: KEY, url: "https://api.resend.com/emails/x", label: "retrieve", fetchImpl: fn });
    assert.equal(got, null);
  } finally {
    console.warn = warn;
  }
  assert.match(warnings[0], /send-only/);
  const net = mockFetch([new Error("ECONNRESET")]);
  await quiet(async () => {
    assert.equal(await http.getResendJson({ key: KEY, url: "u", label: "list", fetchImpl: net.fn }), null);
  });
});

test("server wiring: catch logs message+stack and status calls use the safe helper", () => {
  const server = readFileSync(join(root, "src/lib/housefile/server.ts"), "utf8");
  const fnSrc = server.slice(server.indexOf("export const sendEstimateToHomeowner"), server.indexOf("export const deleteProposal"));
  assert.match(fnSrc, /assertEstimateSendable\(proposal\.status, resend\)/);
  assert.match(fnSrc, /stack/);
  assert.match(fnSrc, /sendFailureReason\(err\)/);
  assert.match(fnSrc, /idempotencyKey: newIdempotencyKey/);
  const mail = readFileSync(join(root, "src/lib/auth/mail.server.ts"), "utf8");
  assert.doesNotMatch(mail, /fetch\(`https:\/\/api\.resend\.com\/emails(\/\$|\?)/);
  const doc = readFileSync(join(root, "src/components/proposal-doc.tsx"), "utf8");
  assert.match(doc, /Re-send estimate/);
});
