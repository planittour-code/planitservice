import {
  ALBIN_CALENDAR_EMAIL,
  TIMEZONE,
  type GoogleBusy,
} from "@/lib/housefile/calendar";

/**
 * Google Calendar for albin@guttersplus.com.
 * Needs a service-account JSON in GOOGLE_CALENDAR_CREDENTIALS, and that
 * account invited on the calendar with "Make changes to events".
 * Without it, availability falls back to PlanitService bookings only.
 */

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

function credentials(): ServiceAccount | null {
  const raw = process.env.GOOGLE_CALENDAR_CREDENTIALS?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function calendarConfigured() {
  return Boolean(credentials());
}

function b64url(input: string | Uint8Array) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function accessToken() {
  const creds = credentials();
  if (!creds) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: creds.client_email,
      scope: "https://www.googleapis.com/auth/calendar",
      aud: creds.token_uri || "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(creds.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${b64url(new Uint8Array(sig))}`;
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });
  const res = await fetch(creds.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    console.error("[calendar] token rejected", res.status, await res.text().catch(() => ""));
    return null;
  }
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}

function pemToDer(pem: string) {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function calendarId() {
  return encodeURIComponent(process.env.GOOGLE_CALENDAR_ID?.trim() || ALBIN_CALENDAR_EMAIL);
}

export async function googleBusy(timeMin: string, timeMax: string): Promise<GoogleBusy[]> {
  const token = await accessToken();
  if (!token) return [];
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone: TIMEZONE,
      items: [{ id: process.env.GOOGLE_CALENDAR_ID?.trim() || ALBIN_CALENDAR_EMAIL }],
    }),
  });
  if (!res.ok) {
    console.error("[calendar] freeBusy failed", res.status, await res.text().catch(() => ""));
    return [];
  }
  const json = (await res.json()) as {
    calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
  };
  const id = process.env.GOOGLE_CALENDAR_ID?.trim() || ALBIN_CALENDAR_EMAIL;
  return json.calendars?.[id]?.busy ?? [];
}

export async function googleInsertEvent(input: {
  start: string;
  end: string;
  summary: string;
  description: string;
}) {
  const token = await accessToken();
  if (!token) return null;
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId()}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.start, timeZone: TIMEZONE },
        end: { dateTime: input.end, timeZone: TIMEZONE },
      }),
    },
  );
  if (!res.ok) {
    console.error("[calendar] insert failed", res.status, await res.text().catch(() => ""));
    return null;
  }
  const json = (await res.json()) as { id?: string };
  return json.id ?? null;
}

export async function googleMoveEvent(eventId: string, start: string, end: string) {
  const token = await accessToken();
  if (!token) return false;
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId()}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        start: { dateTime: start, timeZone: TIMEZONE },
        end: { dateTime: end, timeZone: TIMEZONE },
      }),
    },
  );
  return res.ok;
}

export async function googleCancelEvent(eventId: string) {
  const token = await accessToken();
  if (!token) return false;
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId()}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
  );
  return res.ok || res.status === 404 || res.status === 410;
}
