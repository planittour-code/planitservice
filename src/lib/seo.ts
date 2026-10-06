import { LEGAL_EMAIL, LEGAL_NAME, LEGAL_SITE } from "@/lib/legal";

export const SITE_DESCRIPTION =
  "The file for the house. Keep jobs, products, warranties, and the shop you call back — at the address.";

export function pageHead(opts: {
  title: string;
  description: string;
  path: string;
}) {
  const url = `${LEGAL_SITE}${opts.path === "/" ? "" : opts.path}`;
  const title = opts.title.includes(LEGAL_NAME) ? opts.title : `${opts.title} — ${LEGAL_NAME}`;
  return {
    meta: [
      { title },
      { name: "description", content: opts.description },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: LEGAL_NAME,
    url: LEGAL_SITE,
    email: LEGAL_EMAIL,
    logo: `${LEGAL_SITE}/PS-logo.png`,
    address: {
      "@type": "PostalAddress",
      addressRegion: "GA",
      addressCountry: "US",
    },
  };
}

export function softwareJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: LEGAL_NAME,
    url: LEGAL_SITE,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: SITE_DESCRIPTION,
    offers: {
      "@type": "Offer",
      price: "7.99",
      priceCurrency: "USD",
    },
    provider: organizationJsonLd(),
  };
}

export function localBusinessJsonLd(shop: {
  name: string;
  slug: string;
  phone?: string | null;
  email?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}) {
  const url = `${LEGAL_SITE}/s/${shop.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: shop.name,
    url,
    telephone: shop.phone || undefined,
    email: shop.email || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: shop.street || undefined,
      addressLocality: shop.city || undefined,
      addressRegion: shop.state || undefined,
      postalCode: shop.zip || undefined,
      addressCountry: "US",
    },
  };
}
