/** Public-page CTA pings. Ids and path only — no emails, addresses, or names. */

const KEY = "planit.cta";

function sessionId() {
  try {
    const existing = sessionStorage.getItem(KEY);
    if (existing) return existing;
    const next = crypto.randomUUID();
    sessionStorage.setItem(KEY, next);
    return next;
  } catch {
    return "anon";
  }
}

export function trackCta(name: string, extra?: Record<string, string>) {
  if (typeof window === "undefined") return;
  const payload = {
    name,
    path: window.location.pathname,
    session: sessionId(),
    ...extra,
  };
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/cta", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/cta", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
    }
  } catch {
    /* ignore */
  }
}
