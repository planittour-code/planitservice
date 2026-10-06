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

export function lastName(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const last = parts.at(-1) ?? "";
  return last.replace(/\.$/, "");
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

export function shopSlugFromName(name: string) {
  const base = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "shop";
}

export function fullAddress(p: {
  address_line: string;
  city: string;
  state: string;
  zip: string;
}) {
  return `${p.address_line}, ${p.city}, ${p.state} ${p.zip}`;
}

export function formatPhone(raw: string | null | undefined) {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return (raw ?? "").trim();
}

export function telHref(raw: string | null | undefined) {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `tel:+${digits}`;
  if (digits.length === 10) return `tel:+1${digits}`;
  return digits ? `tel:${digits}` : "";
}

export function formatPlace(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(", ")
    .replace(/\bSe\b/g, "SE")
    .replace(/\bNe\b/g, "NE")
    .replace(/\bNw\b/g, "NW")
    .replace(/\bSw\b/g, "SW")
    .replace(/\bRd,\s/g, "Rd, ")
    .replace(/\bPowersferry\b/gi, "Powers Ferry");
}

export function statusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Needs approval";
    case "draft":
      return "Saved";
    case "sent":
      return "Sent";
    case "revised":
      return "Revised";
    case "accepted":
      return "Accepted";
    case "completed":
      return "Completed";
    case "scheduled":
      return "Scheduled";
    case "overdue":
      return "Overdue";
    case "dueSoon":
      return "Due soon";
    case "current":
      return "Current";
    case "open":
      return "Lead";
    default:
      return status;
  }
}
