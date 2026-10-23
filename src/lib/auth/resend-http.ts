// Dependency-free Resend HTTP helpers. Kept import-free so node:test can load
// this file directly (Node 22 type stripping) with a mocked fetch.

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const BODY_LIMIT = 500;

/** Trim a Resend response body for logs/errors and scrub anything key-shaped. */
export function safeResendBody(body: string, key?: string | null): string {
  let out = body ?? "";
  if (key) out = out.split(key).join("[redacted]");
  out = out.replace(/re_[A-Za-z0-9_]{8,}/g, "re_[redacted]").replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
  out = out.replace(/\s+/g, " ").trim();
  return out.length > BODY_LIMIT ? `${out.slice(0, BODY_LIMIT)}…` : out;
}

export class ResendSendError extends Error {
  status: number;
  body: string;
  reason: string;
  constructor(status: number, body: string) {
    super(`Resend rejected send (HTTP ${status}): ${body || "<empty body>"}`);
    this.name = "ResendSendError";
    this.status = status;
    this.body = body;
    this.reason = resendReason(status, body);
  }
}

/** Short, user-safe explanation of a failed send. Never includes secrets. */
export function resendReason(status: number, body: string): string {
  const text = body.toLowerCase();
  if (status === 0) return "the mail service could not be reached";
  if (text.includes("domain") && text.includes("not verified")) {
    return "the mail key is not allowed to send from this domain";
  }
  if (status === 401 || status === 403) return "the mail service rejected our key";
  if (status === 409) return "this send was already in progress — try again";
  if (status === 422) return "the mail service rejected the message";
  if (status === 429) return "the mail service is rate limiting us — try again in a minute";
  if (status >= 500) return "the mail service is having trouble — try again shortly";
  return `the mail service returned an error (${status})`;
}

/** User-safe reason for any error thrown during a send. */
export function sendFailureReason(err: unknown): string {
  if (err instanceof ResendSendError) return err.reason;
  if (err && typeof err === "object" && "reason" in err && typeof (err as { reason: unknown }).reason === "string") {
    return (err as { reason: string }).reason;
  }
  return "an unexpected error happened while sending";
}

export function newIdempotencyKey(scope: string, attemptId?: string | null): string {
  const attempt = attemptId?.trim() || crypto.randomUUID();
  return `${scope}/${attempt}`.replace(/[^A-Za-z0-9/_:.-]/g, "-").slice(0, 256);
}

function retryable(status: number) {
  return status === 429 || status >= 500;
}

/**
 * POST /emails. Retries transient failures (network, 429, 5xx) with the SAME
 * Idempotency-Key, so Resend never delivers one attempt twice.
 */
export async function postResendEmail(input: {
  key: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  fetchImpl?: FetchLike;
  retries?: number;
  retryDelayMs?: number;
}): Promise<{ id: string | null }> {
  const doFetch: FetchLike = input.fetchImpl ?? ((url, init) => fetch(url, init));
  const retries = input.retries ?? 1;
  let last: ResendSendError | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0 && input.retryDelayMs !== 0) {
      await new Promise((r) => setTimeout(r, input.retryDelayMs ?? 400 * attempt));
    }
    let res: Response;
    try {
      res = await doFetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.key}`,
          "Content-Type": "application/json",
          "Idempotency-Key": input.idempotencyKey,
        },
        body: JSON.stringify(input.payload),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      last = new ResendSendError(0, safeResendBody(message, input.key));
      continue;
    }
    if (res.ok) {
      const payload = (await res.json().catch(() => null)) as { id?: string } | null;
      return { id: payload?.id?.trim() || null };
    }
    const detail = safeResendBody(await res.text().catch(() => ""), input.key);
    last = new ResendSendError(res.status, detail);
    console.error(`[mail] Resend rejected send (${res.status}) ${detail}`);
    if (!retryable(res.status)) break;
  }
  throw last ?? new ResendSendError(0, "");
}

/**
 * GET a Resend status endpoint. Never throws: a send-only key returns
 * 401 restricted_api_key, which is expected and only logged.
 */
export async function getResendJson(input: {
  key: string;
  url: string;
  label: string;
  fetchImpl?: FetchLike;
}): Promise<unknown | null> {
  const doFetch: FetchLike = input.fetchImpl ?? ((url, init) => fetch(url, init));
  try {
    const res = await doFetch(input.url, { headers: { Authorization: `Bearer ${input.key}` } });
    if (!res.ok) {
      const detail = safeResendBody(await res.text().catch(() => ""), input.key);
      if (res.status === 401 && detail.includes("restricted_api_key")) {
        console.warn(`[mail] Resend ${input.label} skipped: key is send-only (401 restricted_api_key)`);
      } else {
        console.error(`[mail] Resend ${input.label} failed (${res.status}) ${detail}`);
      }
      return null;
    }
    return await res.json().catch(() => null);
  } catch (err) {
    console.error(`[mail] Resend ${input.label} failed`, err instanceof Error ? err.message : err);
    return null;
  }
}
