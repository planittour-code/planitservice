import { Camera } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  HOUSE_ROOM_COUNT_FIELDS,
  HOUSE_ROOMS_JSON_KEY,
  HOUSE_YESNO_FIELDS,
  parseHouseRooms,
  roomsFromCounts,
  type HouseRoomFloor,
} from "@/lib/housefile/fields";
import { compressImage } from "@/lib/housefile/image";
import { cn } from "@/lib/utils";

type FactValue = { value?: string };

export function HouseRoomsEditor({
  facts,
  disabled,
  onSave,
}: {
  facts: Record<string, FactValue | undefined>;
  disabled?: boolean;
  onSave: (key: string, value: string) => void | Promise<void>;
}) {
  const [counts, setCounts] = useState(() => ({
    room_count: facts.room_count?.value ?? "",
    toilets: facts.toilets?.value ?? "",
    sinks: facts.sinks?.value ?? "",
    closets: facts.closets?.value ?? "",
    foyer: facts.foyer?.value ?? "",
    mud_room: facts.mud_room?.value ?? "",
  }));
  const [yesNo, setYesNo] = useState(() => ({
    basement: facts.basement?.value === "yes" ? "yes" : facts.basement?.value === "no" ? "no" : "",
    attic: facts.attic?.value === "yes" ? "yes" : facts.attic?.value === "no" ? "no" : "",
  }));
  const [rooms, setRooms] = useState<HouseRoomFloor[]>(() =>
    roomsFromCounts({
      rooms: facts.room_count?.value,
      foyer: facts.foyer?.value,
      mudRoom: facts.mud_room?.value,
      basement: facts.basement?.value,
      attic: facts.attic?.value,
      existing: parseHouseRooms(facts[HOUSE_ROOMS_JSON_KEY]?.value),
    }),
  );



  const shown = useMemo(
    () =>
      roomsFromCounts({
        rooms: counts.room_count,
        foyer: counts.foyer,
        mudRoom: counts.mud_room,
        basement: yesNo.basement,
        attic: yesNo.attic,
        existing: rooms,
      }),
    [counts.room_count, counts.foyer, counts.mud_room, yesNo.basement, yesNo.attic, rooms],
  );

  function persistRooms(next: HouseRoomFloor[]) {
    setRooms(next);
    void onSave(HOUSE_ROOMS_JSON_KEY, JSON.stringify({ items: next }));
  }

  function patchRoom(id: string, patch: Partial<HouseRoomFloor>, save = false) {
    const next = shown.map((row) => (row.id === id ? { ...row, ...patch } : row));
    setRooms(next);
    if (save) void onSave(HOUSE_ROOMS_JSON_KEY, JSON.stringify({ items: next }));
  }

  return (
    <div className="space-y-4 md:col-span-2">
      <div>
        <h4 className="font-display text-base font-bold tracking-tight">Rooms</h4>
        <p className="text-sm text-muted-foreground">
          Quantity blanks for toilets, sinks, closets, foyer, and mud room. Basement and attic are
          yes or no. Flooring for each room can take a photo of the Berber color or hardwood stain.
          Contractors quote from the same rooms.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {HOUSE_ROOM_COUNT_FIELDS.map((field) => (
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
                if (field.key === "room_count" || field.key === "foyer" || field.key === "mud_room") {
                  persistRooms(
                    roomsFromCounts({
                      rooms: field.key === "room_count" ? value : counts.room_count,
                      foyer: field.key === "foyer" ? value : counts.foyer,
                      mudRoom: field.key === "mud_room" ? value : counts.mud_room,
                      basement: yesNo.basement,
                      attic: yesNo.attic,
                      existing: rooms,
                    }),
                  );
                }
              }}
            />
          </div>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {HOUSE_YESNO_FIELDS.map((field) => {
          const value = yesNo[field.key];
          return (
            <div key={field.key} className="space-y-2 rounded-md bg-muted/50 px-2.5 py-2 shadow-[var(--shadow-border)]">
              <p className="text-xs font-medium">{field.label}</p>
              <div className="grid grid-cols-2 gap-2">
                {(["yes", "no"] as const).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    disabled={disabled}
                    className={cn(
                      "min-h-11 rounded-md px-3 text-sm capitalize shadow-[var(--shadow-border)]",
                      value === choice ? "bg-primary text-primary-foreground" : "bg-card",
                    )}
                    onClick={() => {
                      setYesNo((cur) => ({ ...cur, [field.key]: choice }));
                      onSave(field.key, choice);
                      persistRooms(
                        roomsFromCounts({
                          rooms: counts.room_count,
                          foyer: counts.foyer,
                          mudRoom: counts.mud_room,
                          basement: field.key === "basement" ? choice : yesNo.basement,
                          attic: field.key === "attic" ? choice : yesNo.attic,
                          existing: rooms,
                        }),
                      );
                    }}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {shown.length > 0 ? (
        <ul className="space-y-3">
          {shown.map((room) => (
            <li key={room.id}>
              <RoomFloorCard
                room={room}
                disabled={disabled}
                onChange={(patch) => patchRoom(room.id, patch)}
                onCommit={(patch) => patchRoom(room.id, patch, true)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Put a room count, or mark basement / attic yes, to add flooring cards.
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          const n = String((Number.parseInt(counts.room_count, 10) || 0) + 1);
          setCounts((cur) => ({ ...cur, room_count: n }));
          void onSave("room_count", n);
          persistRooms(
            roomsFromCounts({
              rooms: n,
              foyer: counts.foyer,
              mudRoom: counts.mud_room,
              basement: yesNo.basement,
              attic: yesNo.attic,
              existing: rooms,
            }),
          );
        }}
      >
        Add a room
      </Button>
    </div>
  );
}

function RoomFloorCard({
  room,
  disabled,
  onChange,
  onCommit,
}: {
  room: HouseRoomFloor;
  disabled?: boolean;
  onChange: (patch: Partial<HouseRoomFloor>) => void;
  onCommit: (patch: Partial<HouseRoomFloor>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const photo = await compressImage(file, 640, 0.55);
      onCommit({ photo });
      toast.success(`Photo on file for ${room.name}`);
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
        aria-label={`Add flooring photo for ${room.name}`}
      >
        {room.photo ? (
          <img src={room.photo} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1 px-2 text-center text-xs text-muted-foreground">
            <Camera className="size-4" aria-hidden />
            Color / stain
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        id={`room-photo-${room.id}`}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled || busy}
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
      <div className="space-y-2">
        <Input
          value={room.name}
          disabled={disabled}
          aria-label={`${room.name} name`}
          onChange={(e) => onChange({ name: e.target.value })}
          onBlur={(e) => onCommit({ name: e.target.value })}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`flooring-${room.id}`}>Flooring</Label>
            <Input
              id={`flooring-${room.id}`}
              value={room.flooring}
              placeholder="Berber carpet, oak hardwood…"
              disabled={disabled}
              onChange={(e) => onChange({ flooring: e.target.value })}
              onBlur={(e) => onCommit({ flooring: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`stain-${room.id}`}>Color / stain</Label>
            <Input
              id={`stain-${room.id}`}
              value={room.stain}
              placeholder="Sandstone berber, Early American stain"
              disabled={disabled}
              onChange={(e) => onChange({ stain: e.target.value })}
              onBlur={(e) => onCommit({ stain: e.target.value })}
            />
          </div>
        </div>
        {room.photo ? (
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
          <p className="text-xs text-muted-foreground">
            Add a photo of the Berber color or hardwood stain.
          </p>
        )}
      </div>
    </div>
  );
}
