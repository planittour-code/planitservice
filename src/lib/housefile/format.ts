export function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number.isFinite(n) ? n : 0,
  );
}

export function shortDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function yearFrom(iso: string | null | undefined) {
  if (!iso) return "";
  return iso.slice(0, 4);
}

export function num(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function slugToken() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export function fullAddress(p: {
  address_line: string;
  city: string;
  state: string;
  zip: string;
}) {
  return `${p.address_line}, ${p.city}, ${p.state} ${p.zip}`;
}

export function statusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Needs approval";
    case "draft":
      return "Draft";
    case "sent":
      return "Sent";
    case "revised":
      return "Revised";
    case "accepted":
      return "Accepted";
    case "completed":
      return "Completed";
    default:
      return status;
  }
}
