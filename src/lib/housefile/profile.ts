export type SocialKey = "website" | "instagram" | "facebook" | "x" | "linkedin" | "nextdoor" | "youtube";

export type SocialLink = {
  key: SocialKey;
  label: string;
  placeholder: string;
  hostHint: string;
};

export const SOCIAL_LINKS: SocialLink[] = [
  { key: "website", label: "Website", placeholder: "https://yourshop.com", hostHint: "" },
  { key: "instagram", label: "Instagram", placeholder: "instagram.com/you", hostHint: "instagram.com" },
  { key: "facebook", label: "Facebook", placeholder: "facebook.com/you", hostHint: "facebook.com" },
  { key: "x", label: "X", placeholder: "x.com/you", hostHint: "x.com" },
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/you", hostHint: "linkedin.com" },
  { key: "nextdoor", label: "Nextdoor", placeholder: "nextdoor.com/p/you", hostHint: "nextdoor.com" },
  { key: "youtube", label: "YouTube", placeholder: "youtube.com/@you", hostHint: "youtube.com" },
];

export type ProfileHat = "homeowner" | "contractor" | "manager";

export const PROFILE_HAT_LABEL: Record<ProfileHat, string> = {
  homeowner: "Homeowner",
  contractor: "Contractor",
  manager: "Property manager",
};

export const PROFILE_HAT_ORDER: ProfileHat[] = ["homeowner", "contractor", "manager"];

export type UserProfile = {
  userId: string;
  slug: string | null;
  displayName: string;
  headline: string;
  bio: string;
  photoSrc: string | null;
  email: string | null;
  hats: ProfileHat[];
  website: string;
  instagram: string;
  facebook: string;
  x: string;
  linkedin: string;
  nextdoor: string;
  youtube: string;
};

export type PublicProfile = {
  slug: string;
  displayName: string;
  headline: string;
  bio: string;
  photoSrc: string | null;
  email: string | null;
  hats: ProfileHat[];
  links: { key: SocialKey; label: string; href: string }[];
};

const HANDLE = /^[A-Za-z0-9._@/-]+$/;

export function profileSlugFromName(name: string) {
  const base = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return base || "you";
}

export function normalizeHttpUrl(raw: string, hostHint = "") {
  const t = raw.trim();
  if (!t) return "";
  if (t.length > 180) throw new Error("Keep that link under 180 characters.");
  let url = t;
  if (!/^https?:\/\//i.test(url)) {
    if (HANDLE.test(url) && !url.includes(".") && hostHint) {
      const handle = url.replace(/^@/, "");
      url = `https://${hostHint}/${handle}`;
    } else {
      url = `https://${url.replace(/^\/+/, "")}`;
    }
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("That does not look like a web address.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Use an https link.");
  }
  if (hostHint) {
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const want = hostHint.replace(/^www\./, "").toLowerCase();
    const aliases: Record<string, string[]> = {
      "x.com": ["x.com", "twitter.com"],
      "youtube.com": ["youtube.com", "youtu.be"],
      "facebook.com": ["facebook.com", "fb.com"],
    };
    const allowed = aliases[want] ?? [want];
    if (!allowed.some((a) => host === a || host.endsWith(`.${a}`))) {
      throw new Error(`That should be a ${want} link.`);
    }
  }
  parsed.hash = "";
  return parsed.toString();
}

export function filledSocials(profile: Pick<UserProfile, SocialKey>) {
  return SOCIAL_LINKS.flatMap((s) => {
    const href = profile[s.key]?.trim();
    return href ? [{ key: s.key, label: s.label, href }] : [];
  });
}

export function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Y";
  const a = parts[0]![0] ?? "";
  const b = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "";
  return (a + b).toUpperCase();
}
