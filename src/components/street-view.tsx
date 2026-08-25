import { aerialUrl, streetViewEmbed, streetViewLink, zillowLink } from "@/lib/housefile/geocode";

export function StreetView({
  lat,
  lng,
  address,
  city,
  state,
  zip,
}: {
  lat?: number | null;
  lng?: number | null;
  address: string;
  city: string;
  state: string;
  zip: string;
}) {
  const line = [address, city, state, zip].filter(Boolean).join(", ");
  const placed = typeof lat === "number" && typeof lng === "number";
  const zillow = zillowLink(address, city, state, zip);
  const pano = placed
    ? streetViewLink(lat, lng)
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(line)}`;
  const embed = placed
    ? streetViewEmbed(lat, lng)
    : `https://maps.google.com/maps?q=${encodeURIComponent(line)}&layer=c&output=svembed`;

  return (
    <div className="relative aspect-[16/9] bg-muted">
      {placed && (
        <img src={aerialUrl(lat, lng)} alt="" className="absolute inset-0 size-full object-cover" />
      )}
      {line && (
        <iframe
          title={`Street view of ${address}`}
          src={embed}
          className="absolute inset-0 size-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allow="fullscreen"
        />
      )}
      <div className="absolute right-3 bottom-3 flex gap-2">
        <a
          href={pano}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-card/95 px-3 py-2 text-xs font-medium shadow-[var(--shadow-border)]"
        >
          Street View
        </a>
        <a
          href={zillow}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-card/95 px-3 py-2 text-xs font-medium shadow-[var(--shadow-border)]"
        >
          Zillow
        </a>
      </div>
    </div>
  );
}
