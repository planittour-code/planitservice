import { Camera } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  HOUSE_APPLIANCE_COUNT_FIELDS,
  HOUSE_APPLIANCES_JSON_KEY,
  WASHER_DRYER_LOCATION_KEY,
  WASHER_DRYER_SETS_KEY,
  appliancesFromCounts,
  parseHouseAppliances,
  type HouseAppliance,
} from "@/lib/housefile/fields";
import { compressImage } from "@/lib/housefile/image";
import { cn } from "@/lib/utils";

type FactValue = { value?: string };

export function HouseAppliancesEditor({
  facts,
  disabled,
  onSave,
}: {
  facts: Record<string, FactValue | undefined>;
  disabled?: boolean;
  onSave: (key: string, value: string) => void | Promise<void>;
}) {
  const [sets, setSets] = useState(facts[WASHER_DRYER_SETS_KEY]?.value ?? "");
  const [location, setLocation] = useState(facts[WASHER_DRYER_LOCATION_KEY]?.value ?? "");
  const [counts, setCounts] = useState(() => ({
    dishwasher_count: facts.dishwasher_count?.value ?? "",
    refrigerator_count: facts.refrigerator_count?.value ?? "",
    oven_count: facts.oven_count?.value ?? "",
    ice_maker_count: facts.ice_maker_count?.value ?? "",
  }));
  const [items, setItems] = useState<HouseAppliance[]>(() =>
    appliancesFromCounts({
      washerDryerSets: facts[WASHER_DRYER_SETS_KEY]?.value,
      dishwasher: facts.dishwasher_count?.value,
      refrigerator: facts.refrigerator_count?.value,
      oven: facts.oven_count?.value,
      iceMaker: facts.ice_maker_count?.value,
      location: facts[WASHER_DRYER_LOCATION_KEY]?.value,
      existing: parseHouseAppliances(facts[HOUSE_APPLIANCES_JSON_KEY]?.value),
    }),
  );

  const shown = useMemo(
    () =>
      appliancesFromCounts({
        washerDryerSets: sets,
        dishwasher: counts.dishwasher_count,
        refrigerator: counts.refrigerator_count,
        oven: counts.oven_count,
        iceMaker: counts.ice_maker_count,
        location,
        existing: items,
      }),
    [sets, counts, location, items],
  );

  function persist(next: HouseAppliance[]) {
    setItems(next);
    void onSave(HOUSE_APPLIANCES_JSON_KEY, JSON.stringify({ items: next }));
  }

  function rebuild(next: {
    washerDryerSets?: string;
    dishwasher?: string;
    refrigerator?: string;
    oven?: string;
    iceMaker?: string;
    location?: string;
  }) {
    persist(
      appliancesFromCounts({
        washerDryerSets: next.washerDryerSets ?? sets,
        dishwasher: next.dishwasher ?? counts.dishwasher_count,
        refrigerator: next.refrigerator ?? counts.refrigerator_count,
        oven: next.oven ?? counts.oven_count,
        iceMaker: next.iceMaker ?? counts.ice_maker_count,
        location: next.location ?? location,
        existing: items,
      }),
    );
  }

  function patchItem(id: string, patch: Partial<HouseAppliance>, save = false) {
    const next = shown.map((row) => (row.id === id ? { ...row, ...patch } : row));
    setItems(next);
    if (save) void onSave(HOUSE_APPLIANCES_JSON_KEY, JSON.stringify({ items: next }));
  }

  return (
    <div className="space-y-4 md:col-span-2">
      <div>
        <h4 className="font-display text-base font-bold tracking-tight">Appliances</h4>
        <p className="text-sm text-muted-foreground">
          Washer and dryer is 1 or 2 sets, plus location. Add dishwasher, refrigerator how many,
          oven, and ice maker. Make, model, and a photo for each item that stays with the house.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="space-y-1 rounded-md bg-muted/50 px-2.5 py-2 shadow-[var(--shadow-border)]">
          <Label htmlFor={`fact-${WASHER_DRYER_SETS_KEY}`}>Washer and dryer</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["1", "2"] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                disabled={disabled}
                className={cn(
                  "min-h-11 rounded-md px-3 text-sm shadow-[var(--shadow-border)]",
                  sets === choice ? "bg-primary text-primary-foreground" : "bg-card",
                )}
                onClick={() => {
                  setSets(choice);
                  void onSave(WASHER_DRYER_SETS_KEY, choice);
                  rebuild({ washerDryerSets: choice });
                }}
              >
                {choice} {choice === "1" ? "set" : "sets"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1 rounded-md bg-muted/50 px-2.5 py-2 shadow-[var(--shadow-border)] sm:col-span-2">
          <Label htmlFor={`fact-${WASHER_DRYER_LOCATION_KEY}`}>Location</Label>
          <Input
            id={`fact-${WASHER_DRYER_LOCATION_KEY}`}
            value={location}
            placeholder="Laundry room, basement, garage"
            disabled={disabled}
            onChange={(e) => setLocation(e.target.value)}
            onBlur={(e) => {
              const value = e.target.value.trim();
              setLocation(value);
              void onSave(WASHER_DRYER_LOCATION_KEY, value);
              rebuild({ location: value });
            }}
          />
        </div>
        {HOUSE_APPLIANCE_COUNT_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1 rounded-md bg-muted/50 px-2.5 py-2 shadow-[var(--shadow-border)]">
            <Label htmlFor={`fact-${field.key}`}>{field.label}</Label>
            <Input
              id={`fact-${field.key}`}
              inputMode="numeric"
              value={counts[field.key]}
              placeholder={field.placeholder}
              disabled={disabled}
              onChange={(e) => setCounts((cur) => ({ ...cur, [field.key]: e.target.value }))}
              onBlur={(e) => {
                const value = e.target.value.trim();
                setCounts((cur) => ({ ...cur, [field.key]: value }));
                void onSave(field.key, value);
                rebuild({
                  dishwasher: field.key === "dishwasher_count" ? value : undefined,
                  refrigerator: field.key === "refrigerator_count" ? value : undefined,
                  oven: field.key === "oven_count" ? value : undefined,
                  iceMaker: field.key === "ice_maker_count" ? value : undefined,
                });
              }}
            />
          </div>
        ))}
      </div>

      {shown.length > 0 ? (
        <ul className="space-y-3">
          {shown.map((item) => (
            <li key={item.id}>
              <ApplianceCard
                item={item}
                disabled={disabled}
                onChange={(patch) => patchItem(item.id, patch)}
                onCommit={(patch) => patchItem(item.id, patch, true)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Pick 1 or 2 washer and dryer sets, or put a count on dishwasher, refrigerator, oven, or
          ice maker to add make, model, and a photo.
        </p>
      )}
    </div>
  );
}

function ApplianceCard({
  item,
  disabled,
  onChange,
  onCommit,
}: {
  item: HouseAppliance;
  disabled?: boolean;
  onChange: (patch: Partial<HouseAppliance>) => void;
  onCommit: (patch: Partial<HouseAppliance>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const laundry = item.kind === "washer_dryer";

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const photo = await compressImage(file, 640, 0.55);
      onCommit({ photo });
      toast.success(`Photo on file for ${item.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read the photo");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-3 rounded-lg bg-background p-3 shadow-[var(--shadow-border)] sm:grid-cols-[7rem_1fr]">
      <button
        type="button"
        disabled={disabled || busy}
        className="relative aspect-square overflow-hidden rounded-md bg-muted"
        onClick={() => inputRef.current?.click()}
        aria-label={`Add photo for ${item.name}`}
      >
        {item.photo ? (
          <img src={item.photo} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1 px-2 text-center text-xs text-muted-foreground">
            <Camera className="size-4" aria-hidden />
            Photo
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        id={`appliance-photo-${item.id}`}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled || busy}
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
      <div className="space-y-2">
        <p className="text-sm font-medium">{item.name}</p>
        {laundry ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`washer-make-${item.id}`}>Washer make</Label>
                <Input
                  id={`washer-make-${item.id}`}
                  value={item.washerMake}
                  placeholder="Whirlpool"
                  disabled={disabled}
                  onChange={(e) => onChange({ washerMake: e.target.value })}
                  onBlur={(e) => onCommit({ washerMake: e.target.value.trim() })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`washer-model-${item.id}`}>Washer model</Label>
                <Input
                  id={`washer-model-${item.id}`}
                  value={item.washerModel}
                  placeholder="WTW5057LW"
                  disabled={disabled}
                  onChange={(e) => onChange({ washerModel: e.target.value })}
                  onBlur={(e) => onCommit({ washerModel: e.target.value.trim() })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`dryer-make-${item.id}`}>Dryer make</Label>
                <Input
                  id={`dryer-make-${item.id}`}
                  value={item.dryerMake}
                  placeholder="Whirlpool"
                  disabled={disabled}
                  onChange={(e) => onChange({ dryerMake: e.target.value })}
                  onBlur={(e) => onCommit({ dryerMake: e.target.value.trim() })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`dryer-model-${item.id}`}>Dryer model</Label>
                <Input
                  id={`dryer-model-${item.id}`}
                  value={item.dryerModel}
                  placeholder="WED5050LW"
                  disabled={disabled}
                  onChange={(e) => onChange({ dryerModel: e.target.value })}
                  onBlur={(e) => onCommit({ dryerModel: e.target.value.trim() })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`location-${item.id}`}>Location</Label>
              <Input
                id={`location-${item.id}`}
                value={item.location}
                placeholder="Laundry room"
                disabled={disabled}
                onChange={(e) => onChange({ location: e.target.value })}
                onBlur={(e) => onCommit({ location: e.target.value.trim() })}
              />
            </div>
          </>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`make-${item.id}`}>Make</Label>
              <Input
                id={`make-${item.id}`}
                value={item.make}
                placeholder="GE, Samsung, Bosch…"
                disabled={disabled}
                onChange={(e) => onChange({ make: e.target.value })}
                onBlur={(e) => onCommit({ make: e.target.value.trim() })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`model-${item.id}`}>Model</Label>
              <Input
                id={`model-${item.id}`}
                value={item.model}
                placeholder="Model number"
                disabled={disabled}
                onChange={(e) => onChange({ model: e.target.value })}
                onBlur={(e) => onCommit({ model: e.target.value.trim() })}
              />
            </div>
          </div>
        )}
        {item.photo ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => onCommit({ photo: "" })}
          >
            Remove photo
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Add a photo of this appliance.</p>
        )}
      </div>
    </div>
  );
}
