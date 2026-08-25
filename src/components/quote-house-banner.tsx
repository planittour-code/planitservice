import { Camera } from "lucide-react";
import { useRef } from "react";
import { StreetView } from "@/components/street-view";
import { compressImage } from "@/lib/housefile/image";
import { toast } from "sonner";

export const MAPLE_DEMO = {
  address: "142 Maple Street",
  city: "Marietta",
  state: "GA",
  zip: "30064",
  name: "Margaret Hale",
  photo: "/houses/maple-front.jpg",
  facts: {
    year_built: "1924",
    square_feet: "1840",
    stories: "1.5",
  },
};

export function QuoteHouseBanner({
  guest,
  address,
  city,
  state,
  zip,
  name,
  photo,
  lat,
  lng,
  onAddPhoto,
}: {
  guest: boolean;
  address: string;
  city: string;
  state: string;
  zip: string;
  name?: string;
  photo: string | null;
  lat?: number | null;
  lng?: number | null;
  onAddPhoto?: (src: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const place = [city, state, zip].filter(Boolean).join(" ");
  const line = address || "Enter the job address";

  async function onPick(file: File | undefined) {
    if (!file || !onAddPhoto) return;
    try {
      onAddPhoto(await compressImage(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add photo");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <figure className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
      {photo ? (
        <div className="relative">
          <img src={photo} alt="" className="aspect-[16/9] w-full object-cover" />
          {onAddPhoto && (
            <label className="absolute right-3 bottom-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-card/95 px-3 text-sm font-medium shadow-[var(--shadow-border)]">
              <Camera className="size-4" />
              Change photo
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => void onPick(e.target.files?.[0])}
              />
            </label>
          )}
        </div>
      ) : address ? (
        <div className="relative">
          <StreetView lat={lat} lng={lng} address={address} city={city} state={state} zip={zip} />
          {onAddPhoto && (
            <label className="absolute top-3 right-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-card/95 px-3 text-sm font-medium shadow-[var(--shadow-border)]">
              <Camera className="size-4" />
              Add photo
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => void onPick(e.target.files?.[0])}
              />
            </label>
          )}
        </div>
      ) : (
        <label className="flex aspect-[16/9] cursor-pointer flex-col items-center justify-center gap-2 bg-muted text-sm text-muted-foreground">
          <Camera className="size-6 text-primary" />
          Add photo
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => void onPick(e.target.files?.[0])}
          />
        </label>
      )}
      <figcaption className="space-y-0.5 px-4 py-3">
        <p className="font-display text-xl font-medium">{line}</p>
        <p className="text-sm text-muted-foreground">
          {place || (guest ? "" : "City and state")}
          {name ? ` · ${name}` : ""}
        </p>
      </figcaption>
    </figure>
  );
}
