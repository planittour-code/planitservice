/**
 * Shared Gutters Plus calendar.
 * Source of truth is the Google calendar for albin@guttersplus.com.
 * The public page and the voice agent both call these helpers.
 */

export const ALBIN_CALENDAR_EMAIL = "albin@guttersplus.com";
export const ALBIN_FROM = "Albin at Gutters Plus <albin@mail.planitservice.com>";
export const ALBIN_REPLY_TO = "albin@guttersplus.com";

/** Days from today that stay closed, so the crew is not booked on short notice. */
export const BUFFER_LEAD_DAYS = 3;
/** Openings offered each working day after Google busy time is removed. */
export const SLOTS_PER_DAY = 2;
/** Working window, America/New_York. Two slots: morning and afternoon. */
export const SLOT_HOURS = [9, 13];
export const SLOT_MINUTES = 120;
export const LOOKAHEAD_DAYS = 21;
export const TIMEZONE = "America/New_York";

export const BOOKING_SERVICES = [
  { id: "cleaning", label: "Seasonal gutter cleaning" },
  { id: "package", label: "3-visit service package" },
] as const;

export const PROJECT_SERVICES = [
  { id: "gutters", label: "Gutter cleaning package" },
  { id: "paint", label: "Painting & pressure washing" },
  { id: "windows", label: "Windows & siding" },
  { id: "porch", label: "Porches & outdoor living" },
] as const;

export type BookingServiceId = (typeof BOOKING_SERVICES)[number]["id"];
export type ProjectServiceId = (typeof PROJECT_SERVICES)[number]["id"];

export type OpenSlot = {
  start: string;
  end: string;
  label: string;
};

export type GoogleBusy = { start: string; end: string };

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Wall-clock date parts in America/New_York. */
export function nyParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    weekday: bag.weekday ?? "",
  };
}

function nyOffset(year: number, month: number, day: number, hour: number) {
  const utc = Date.UTC(year, month - 1, day, hour, 0, 0);
  const probe = new Date(utc);
  const parts = nyParts(probe);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
  const diffMin = Math.round((asUtc - utc) / 60000);
  const sign = diffMin >= 0 ? "+" : "-";
  const abs = Math.abs(diffMin);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** ISO timestamp for a New York wall-clock time. */
export function nyStamp(year: number, month: number, day: number, hour: number) {
  const offset = nyOffset(year, month, day, hour);
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:00:00${offset}`;
}

export function addDays(year: number, month: number, day: number, days: number) {
  const d = new Date(Date.UTC(year, month - 1, day + days, 12));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Calendar day in America/New_York for a booked slot. */
export function slotDay(startIso: string) {
  const parts = nyParts(new Date(startIso));
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function slotLabel(startIso: string) {
  const d = new Date(startIso);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Openings a visitor or the voice agent may take.
 * Closed inside the lead buffer, on weekends, and wherever Google already has an event.
 */
export function openSlots(busy: GoogleBusy[], now = new Date()): OpenSlot[] {
  const today = nyParts(now);
  const startDay = addDays(today.year, today.month, today.day, BUFFER_LEAD_DAYS);
  const slots: OpenSlot[] = [];
  for (let i = 0; i < LOOKAHEAD_DAYS; i++) {
    const day = addDays(startDay.year, startDay.month, startDay.day, i);
    const probe = new Date(nyStamp(day.year, day.month, day.day, 12));
    const weekday = nyParts(probe).weekday;
    if (weekday === "Sat" || weekday === "Sun") continue;
    for (const hour of SLOT_HOURS) {
      const start = nyStamp(day.year, day.month, day.day, hour);
      const endDate = new Date(new Date(start).getTime() + SLOT_MINUTES * 60_000);
      const end = endDate.toISOString();
      const startMs = new Date(start).getTime();
      const endMs = endDate.getTime();
      const taken = busy.some((b) =>
        overlaps(startMs, endMs, new Date(b.start).getTime(), new Date(b.end).getTime()),
      );
      if (taken) continue;
      slots.push({ start, end: endDate.toISOString(), label: slotLabel(start) });
    }
  }
  return slots;
}

export function serviceLabel(id: string) {
  return (
    BOOKING_SERVICES.find((s) => s.id === id)?.label ??
    PROJECT_SERVICES.find((s) => s.id === id)?.label ??
    id
  );
}

export function confirmationCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}
