import { Camera, X } from "lucide-react";
import { useRef } from "react";
import { StreetView } from "@/components/street-view";
import { compressImage } from "@/lib/housefile/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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

const HOUSE_PHOTO_MAX = 8;

export function QuoteHouseBanner({
  guest,
  address,
  city,
  state,
  zip,
  name,
  photo,
  photos,
  lat,
  lng,
  onAddPhoto,
  onRemovePhoto,
}: {
  guest: boolean;
  address: string;
  city: string;
  state: string;
  zip: string;
  name?: string;
  photo: string | null;
  photos?: string[];
  lat?: number | null;
  lng?: number | null;
  onAddPhoto?: (src: string) => void;
  onRemovePhoto?: (src: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const place = [city, state, zip].filter(Boolean).join(" ");
  const line = address || "Enter the job address";
  const gallery = (photos?.length ? photos : photo ? [photo] : []).slice(0, HOUSE_PHOTO_MAX);
  const hero = gallery[0] ?? photo;
  const canAdd = Boolean(onAddPhoto) && gallery.length < HOUSE_PHOTO_MAX;

  async function onPick(files: FileList | null) {
    if (!files?.length || !onAddPhoto) return;
    const room = HOUSE_PHOTO_MAX - gallery.length;
    try {
      for (const file of Array.from(files).slice(0, room)) {
        onAddPhoto(await compressImage(file, 1000));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add photo");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const addControl = canAdd ? (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-card/95 px-3 text-sm font-medium shadow-[var(--shadow-border)]">
      <Camera className="size-4" />
      {gallery.length ? "Add photo" : "Add photo"}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => void onPick(e.target.files)}
      />
    </label>
  ) : null;

  return (
    <figure className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
      {hero ? (
        <div className="relative">
          <img src={hero} alt="" className="aspect-[16/9] w-full object-cover" />
          {addControl ? <div className="absolute right-3 bottom-3">{addControl}</div> : null}
        </div>
      ) : address ? (
        <div className="relative">
          <StreetView lat={lat} lng={lng} address={address} city={city} state={state} zip={zip} />
          {addControl ? <div className="absolute top-3 right-3">{addControl}</div> : null}
        </div>
      ) : canAdd ? (
        <label className="flex aspect-[16/9] cursor-pointer flex-col items-center justify-center gap-2 bg-muted text-sm text-muted-foreground">
          <Camera className="size-6 text-primary" />
          Add up to {HOUSE_PHOTO_MAX} house photos
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => void onPick(e.target.files)}
          />
        </label>
      ) : (
        <div className="flex aspect-[16/9] flex-col items-center justify-center gap-2 bg-muted text-sm text-muted-foreground">
          <Camera className="size-6 text-primary" />
          House photo
        </div>
      )}
      {gallery.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5 px-3 pt-3 sm:grid-cols-8">
          {gallery.map((src, i) => (
            <div key={`${src.slice(0, 24)}-${i}`} className="relative overflow-hidden rounded-md bg-muted">
              <img src={src} alt="" className="aspect-square w-full object-cover" />
              {onRemovePhoto && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="absolute top-0.5 right-0.5 size-7 bg-background/90"
                  aria-label="Remove house photo"
                  onClick={() => onRemovePhoto(src)}
                >
                  <X className="size-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      <figcaption className="space-y-0.5 px-4 py-3">
        <p className="font-display text-xl font-medium">{line}</p>
        <p className="text-sm text-muted-foreground">
          {place || (guest ? "" : "City and state")}
          {name ? ` · ${name}` : ""}
          {onAddPhoto ? ` · ${gallery.length} of ${HOUSE_PHOTO_MAX} photos` : ""}
        </p>
      </figcaption>
    </figure>
  );
}
