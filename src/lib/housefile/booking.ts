import { getSql, type Sql } from "@/lib/db";
import {
  sendBookingConfirmationEmail,
  sendProjectOpenedEmail,
  sendTransferToOwnerEmail,
} from "@/lib/auth/mail.server";
import {
  ALBIN_CALENDAR_EMAIL,
  BOOKING_SERVICES,
  PROJECT_SERVICES,
  SLOTS_PER_DAY,
  confirmationCode,
  openSlots,
  serviceLabel,
  slotLabel,
  type BookingServiceId,
  type GoogleBusy,
  type ProjectServiceId,
} from "@/lib/housefile/calendar";
import {
  calendarConfigured,
  googleBusy,
  googleCancelEvent,
  googleInsertEvent,
  googleMoveEvent,
} from "@/lib/housefile/google-calendar";
import { slugToken } from "@/lib/housefile/format";
import { MAINTENANCE_LIBRARY, nextDue } from "@/lib/housefile/maintain";

const HOUSEHOLD = "co_household";

export type BookingRow = {
  id: string;
  company_id: string | null;
  shop_email: string;
  calendar_event_id: string | null;
  slot_start: string;
  slot_end: string;
  service: string;
  name: string;
  email: string;
  phone: string | null;
  address_line: string | null;
  confirmation_code: string;
  source: string;
  status: string;
  created_at: string;
};

function publicOrigin() {
  return (process.env.BETTER_AUTH_URL?.trim() || "https://planitservice.com").replace(/\/+$/, "");
}

function isMail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function guttersPlusCompany(sql: Sql) {
  const rows = await sql<{ id: string; name: string; email: string | null }>`
    select id, name, email from companies
    where lower(email) = ${ALBIN_CALENDAR_EMAIL}
       or lower(name) like ${"%gutters plus%"}
       or lower(name) like ${"%guttersplus%"}
    order by case when lower(email) = ${ALBIN_CALENDAR_EMAIL} then 0 else 1 end
    limit 1
  `;
  return rows[0] ?? null;
}

async function liveBookings(sql: Sql, fromIso: string): Promise<BookingRow[]> {
  return sql<BookingRow>`
    select * from shop_bookings
    where shop_email = ${ALBIN_CALENDAR_EMAIL}
      and status = ${"booked"}
      and slot_start >= ${fromIso}::timestamptz
    order by slot_start
  `;
}

export async function listOpenSlots() {
  const sql = await getSql();
  const now = new Date();
  const horizon = new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000);
  const local = await liveBookings(sql, now.toISOString());
  const google = await googleBusy(now.toISOString(), horizon.toISOString());
  const busy: GoogleBusy[] = [
    ...google,
    ...local.map((row) => ({ start: row.slot_start, end: row.slot_end })),
  ];
  const slots = openSlots(busy, now);
  const perDay = new Map<string, number>();
  const capped = slots.filter((slot) => {
    const day = slot.start.slice(0, 10);
    const n = perDay.get(day) ?? 0;
    if (n >= SLOTS_PER_DAY) return false;
    perDay.set(day, n + 1);
    return true;
  });
  return {
    calendar: ALBIN_CALENDAR_EMAIL,
    googleConnected: calendarConfigured(),
    slots: capped,
    services: BOOKING_SERVICES,
  };
}

export async function bookSlot(input: {
  start: string;
  service: BookingServiceId | string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  source: "web" | "voice";
}) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 2) throw new Error("Need a name.");
  if (!isMail(email)) throw new Error("Need an email for the confirmation.");
  const offered = await listOpenSlots();
  const slot = offered.slots.find((s) => s.start === input.start);
  if (!slot) throw new Error("That time was just taken. Pick another opening.");
  const service = serviceLabel(input.service);
  const sql = await getSql();
  const company = await guttersPlusCompany(sql);
  const id = crypto.randomUUID();
  const code = confirmationCode();
  const address = input.address?.trim() || null;
  const eventId = await googleInsertEvent({
    start: slot.start,
    end: slot.end,
    summary: `${service} — ${name}`,
    description: [
      `Confirmation ${code}`,
      `Email ${email}`,
      input.phone ? `Phone ${input.phone}` : "",
      address ? `Address ${address}` : "",
      `Booked from ${input.source}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
  try {
    await sql`
      insert into shop_bookings (
        id, company_id, shop_email, calendar_event_id, slot_start, slot_end,
        service, name, email, phone, address_line, confirmation_code, source, status
      ) values (
        ${id}, ${company?.id ?? null}, ${ALBIN_CALENDAR_EMAIL}, ${eventId},
        ${slot.start}::timestamptz, ${slot.end}::timestamptz,
        ${service}, ${name}, ${email}, ${input.phone?.trim() || null}, ${address},
        ${code}, ${input.source}, ${"booked"}
      )
    `;
  } catch (err) {
    if (eventId) await googleCancelEvent(eventId);
    const message = err instanceof Error ? err.message : "";
    if (/unique|duplicate/i.test(message)) {
      throw new Error("That time was just taken. Pick another opening.");
    }
    throw err;
  }
  const when = slotLabel(slot.start);
  try {
    await sendBookingConfirmationEmail({
      to: email,
      name,
      whenLabel: when,
      service,
      code,
      address: address ?? undefined,
    });
  } catch (err) {
    console.error("[mail] booking confirmation failed", err);
  }
  return {
    ok: true as const,
    confirmationCode: code,
    when,
    start: slot.start,
    end: slot.end,
    service,
    calendar: ALBIN_CALENDAR_EMAIL,
  };
}

export async function moveBooking(input: {
  companyId: string;
  bookingId: string;
  start: string;
}) {
  const sql = await getSql();
  const rows = await sql<BookingRow>`
    select * from shop_bookings
    where id = ${input.bookingId} and company_id = ${input.companyId} and status = ${"booked"}
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new Error("Booking not found.");
  const offered = await listOpenSlots();
  const slot = offered.slots.find((s) => s.start === input.start);
  if (!slot) throw new Error("That time is not open.");
  await sql`
    update shop_bookings
    set status = ${"moved"}
    where id = ${row.id}
  `;
  try {
    await sql`
      update shop_bookings
      set slot_start = ${slot.start}::timestamptz,
          slot_end = ${slot.end}::timestamptz,
          status = ${"booked"}
      where id = ${row.id}
    `;
  } catch (err) {
    await sql`update shop_bookings set status = ${"booked"} where id = ${row.id}`;
    throw new Error("That time was just taken.");
  }
  if (row.calendar_event_id) {
    await googleMoveEvent(row.calendar_event_id, slot.start, slot.end);
  }
  const when = slotLabel(slot.start);
  try {
    await sendBookingConfirmationEmail({
      to: row.email,
      name: row.name,
      whenLabel: when,
      service: row.service,
      code: row.confirmation_code,
      address: row.address_line ?? undefined,
      moved: true,
    });
  } catch (err) {
    console.error("[mail] move confirmation failed", err);
  }
  return { ok: true as const, when };
}

export async function cancelBooking(companyId: string, bookingId: string) {
  const sql = await getSql();
  const rows = await sql<BookingRow>`
    select * from shop_bookings
    where id = ${bookingId} and company_id = ${companyId} and status = ${"booked"}
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new Error("Booking not found.");
  await sql`update shop_bookings set status = ${"canceled"} where id = ${row.id}`;
  if (row.calendar_event_id) await googleCancelEvent(row.calendar_event_id);
  return { ok: true as const };
}

export async function listShopBookings(companyId: string) {
  const sql = await getSql();
  return sql<BookingRow>`
    select * from shop_bookings
    where company_id = ${companyId} and status = ${"booked"} and slot_start >= now() - interval '1 day'
    order by slot_start
  `;
}

export async function notifyOwnerTransfer(input: {
  callerName: string;
  callerPhone: string;
  note: string;
}) {
  await sendTransferToOwnerEmail(input);
  return { ok: true as const, transferredTo: ALBIN_CALENDAR_EMAIL };
}

async function seedFile(sql: Sql, propertyId: string) {
  const existing = await sql<{ c: number }>`
    select count(*)::int as c from maintenance_tasks where property_id = ${propertyId}
  `;
  if (Number(existing[0]?.c ?? 0) > 0) return;
  const start = new Date();
  for (const item of MAINTENANCE_LIBRARY) {
    await sql`
      insert into maintenance_tasks (id, property_id, title, system_name, cadence, due_on)
      values (
        ${crypto.randomUUID()}, ${propertyId}, ${item.title}, ${item.system}, ${item.cadence},
        ${nextDue(item.cadence, start)}
      )
    `;
  }
}

export async function openProjectLead(input: {
  name: string;
  email: string;
  phone?: string;
  addressLine: string;
  city?: string;
  state?: string;
  zip?: string;
  workId: ProjectServiceId | string;
  source: "web" | "voice";
}) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const address = input.addressLine.trim();
  if (name.length < 2) throw new Error("Need a name.");
  if (!isMail(email)) throw new Error("Need an email.");
  if (address.length < 4) throw new Error("Need the street address.");
  const work = PROJECT_SERVICES.find((s) => s.id === input.workId) ?? PROJECT_SERVICES[0];
  const sql = await getSql();
  const company = await guttersPlusCompany(sql);
  const shopId = company?.id ?? null;
  const shopName = company?.name ?? "Gutters Plus";

  const shopRows = shopId
    ? await sql<{ id: string; address_line: string; zip: string; invite_token: string }>`
        select id, address_line, zip, invite_token from properties where company_id = ${shopId}
      `
    : [];
  const zip = input.zip?.trim() || "—";
  const match = shopRows.find(
    (row) =>
      row.address_line.trim().toLowerCase() === address.toLowerCase() &&
      row.zip.trim().slice(0, 5) === zip.slice(0, 5),
  );
  let propertyId = match?.id;
  let invite = match?.invite_token;
  if (!propertyId) {
    propertyId = crypto.randomUUID();
    invite = slugToken();
    await sql`
      insert into properties (
        id, company_id, share_token, invite_token, invite_status,
        address_line, city, state, zip, homeowner_name, homeowner_email, homeowner_phone, notes
      ) values (
        ${propertyId}, ${shopId ?? HOUSEHOLD}, ${slugToken()}, ${invite}, ${"sent"},
        ${address}, ${input.city?.trim() || "—"}, ${input.state?.trim() || "GA"}, ${zip},
        ${name}, ${email}, ${input.phone?.trim() || null},
        ${`Opened from ${input.source}. Work requested: ${work.label}. Complimentary Property Record.`}
      )
    `;
  }

  const household = await sql<{ id: string; invite_token: string }>`
    select id, invite_token from properties
    where company_id = ${HOUSEHOLD}
      and lower(homeowner_email) = ${email}
      and lower(address_line) = ${address.toLowerCase()}
    limit 1
  `;
  let fileId = household[0]?.id;
  let fileInvite = household[0]?.invite_token;
  if (!fileId) {
    fileId = crypto.randomUUID();
    fileInvite = slugToken();
    await sql`
      insert into properties (
        id, company_id, share_token, invite_token, invite_status,
        address_line, city, state, zip, homeowner_name, homeowner_email, homeowner_phone
      ) values (
        ${fileId}, ${HOUSEHOLD}, ${slugToken()}, ${fileInvite}, ${"sent"},
        ${address}, ${input.city?.trim() || "—"}, ${input.state?.trim() || "GA"}, ${zip},
        ${name}, ${email}, ${input.phone?.trim() || null}
      )
    `;
    const freeUntil = new Date();
    freeUntil.setDate(freeUntil.getDate() + 365);
    await sql`
      insert into property_plans (property_id, cadence, tier, status, renews_on, complimentary_until)
      values (
        ${fileId}, ${"monthly"}, ${"standard"}, ${"complimentary"},
        ${freeUntil.toISOString().slice(0, 10)}::date, null
      )
      on conflict (property_id) do nothing
    `;
    await seedFile(sql, fileId);
  }

  const inviteId = crypto.randomUUID();
  const share = slugToken();
  await sql`
    insert into file_work_invites (
      id, property_id, invited_by_user_id, shop_email, shop_name, title, body, share_token, status
    ) values (
      ${inviteId}, ${fileId}, ${"mailer"}, ${ALBIN_CALENDAR_EMAIL}, ${shopName},
      ${work.label},
      ${`${name} asked Gutters Plus to quote ${work.label} at ${address}. Opened from the seasonal mailer (${input.source}). The Property Record is free until 30 days after Start Work.`},
      ${share}, ${"open"}
    )
  `;

  const inviteUrl = `${publicOrigin()}/invite/${fileInvite}`;
  try {
    await sendProjectOpenedEmail({
      to: email,
      name,
      address,
      work: work.label,
      inviteUrl,
    });
  } catch (err) {
    console.error("[mail] project opened email failed", err);
  }
  return {
    ok: true as const,
    inviteUrl,
    work: work.label,
    address,
  };
}

/** 30 days of free file access begin when the homeowner clicks Start Work (accept). */
export async function stampComplimentaryWindow(sql: Sql, propertyId: string, startedAt: Date) {
  const until = new Date(startedAt);
  until.setDate(until.getDate() + 30);
  const day = until.toISOString().slice(0, 10);
  const files = await sql<{ id: string }>`
    select h.id
    from properties shop
    join properties h on h.company_id = ${HOUSEHOLD}
      and lower(h.homeowner_email) = lower(shop.homeowner_email)
      and lower(h.address_line) = lower(shop.address_line)
    where shop.id = ${propertyId}
  `;
  for (const file of files) {
    await sql`
      insert into property_plans (property_id, cadence, tier, status, renews_on, complimentary_until)
      values (${file.id}, ${"monthly"}, ${"standard"}, ${"complimentary"}, ${day}::date, ${day}::date)
      on conflict (property_id) do update
        set complimentary_until = coalesce(property_plans.complimentary_until, excluded.complimentary_until),
            status = case
              when property_plans.status = ${"active"} then property_plans.status
              else ${"complimentary"}
            end
    `;
  }
}
