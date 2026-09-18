import { Camera } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  HOUSE_BASEMENT_DETAIL_FIELDS,
  HOUSE_DRAINAGE_OPTIONS,
  HOUSE_ROOM_COUNT_FIELDS,
  HOUSE_ROOM_SHARED_FIELDS,
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
    basement: facts.basement?.value === "yes" ? "1" : facts.basement?.value === "no" ? "" : (facts.basement?.value ?? ""),
    attic: facts.attic?.value === "yes" ? "1" : facts.attic?.value === "no" ? "" : (facts.attic?.value ?? ""),
    interior_doors: facts.interior_doors?.value ?? "",
    exterior_doors: facts.exterior_doors?.value ?? "",
  }));
  const [appliedRooms, setAppliedRooms] = useState(facts.room_count?.value ?? "");
  const [addition, setAddition] = useState(facts.addition?.value === "yes" ? "yes" : "");
  const [basementDetails, setBasementDetails] = useState(() => ({
    basement_finished: facts.basement_finished?.value ?? "",
    basement_unfinished: facts.basement_unfinished?.value ?? "",
    basement_stairs: facts.basement_stairs?.value ?? "",
    basement_doors: facts.basement_doors?.value ?? "",
  }));
  const [drainage, setDrainage] = useState(facts.drainage?.value ?? "");
  const [shared, setShared] = useState(() => ({
    ceiling_height: facts.ceiling_height?.value ?? "",
    interior_trim_paint: facts.interior_trim_paint?.value ?? "",
  }));
  const [rooms, setRooms] = useState<HouseRoomFloor[]>(() =>
    roomsFromCounts({
      rooms: facts.room_count?.value,
      foyer: facts.foyer?.value,
      mudRoom: facts.mud_room?.value,
      basement: facts.basement?.value,
      attic: facts.attic?.value,
      addition: facts.addition?.value,
      existing: parseHouseRooms(facts[HOUSE_ROOMS_JSON_KEY]?.value),
    }),
  );

  const shown = useMemo(
    () =>
      roomsFromCounts({
        rooms: appliedRooms,
        foyer: counts.foyer,
        mudRoom: counts.mud_room,
        basement: counts.basement,
        attic: counts.attic,
        addition,
        existing: rooms,
      }),
    [appliedRooms, counts.foyer, counts.mud_room, counts.basement, counts.attic, addition, rooms],
  );

  const draftRooms = counts.room_count.trim();
  const roomsDirty = draftRooms !== appliedRooms.trim();

  function persistRooms(next: HouseRoomFloor[]) {
    setRooms(next);
    void onSave(HOUSE_ROOMS_JSON_KEY, JSON.stringify({ items: next }));
  }

  function patchRoom(id: string, patch: Partial<HouseRoomFloor>, save = false) {
    const next = shown.map((row) => (row.id === id ? { ...row, ...patch } : row));
    setRooms(next);
    if (save) void onSave(HOUSE_ROOMS_JSON_KEY, JSON.stringify({ items: next }));
  }

  function removeRoom(room: HouseRoomFloor) {
    const next = shown.filter((row) => row.id !== room.id);
    const remaining = (kind: HouseRoomFloor["kind"]) => {
      const n = next.filter((row) => row.kind === kind).length;
      return n ? String(n) : "";
    };
    const nextCounts = {
      ...counts,
      room_count: remaining("room"),
      foyer: remaining("foyer"),
      mud_room: remaining("mud_room"),
      basement: remaining("basement"),
      attic: remaining("attic"),
    };
    const nextAddition = next.some((row) => row.kind === "addition") ? "yes" : "";
    setCounts(nextCounts);
    if (room.kind === "room") {
      setAppliedRooms(nextCounts.room_count);
      void onSave("room_count", nextCounts.room_count);
    }
    if (room.kind === "foyer") void onSave("foyer", nextCounts.foyer);
    if (room.kind === "mud_room") void onSave("mud_room", nextCounts.mud_room);
    if (room.kind === "basement") void onSave("basement", nextCounts.basement);
    if (room.kind === "attic") void onSave("attic", nextCounts.attic);
    if (room.kind === "addition") {
      setAddition(nextAddition);
      void onSave("addition", nextAddition);
    }
    persistRooms(
      roomsFromCounts({
        rooms: nextCounts.room_count,
        foyer: nextCounts.foyer,
        mudRoom: nextCounts.mud_room,
        basement: nextCounts.basement,
        attic: nextCounts.attic,
        addition: nextAddition,
        existing: next,
      }),
    );
  }

  function applyRoomCount() {
    const value = counts.room_count.trim();
    setCounts((cur) => ({ ...cur, room_count: value }));
    setAppliedRooms(value);
    void onSave("room_count", value);
    persistRooms(
      roomsFromCounts({
        rooms: value,
        foyer: counts.foyer,
        mudRoom: counts.mud_room,
        basement: counts.basement,
        attic: counts.attic,
        addition,
        existing: rooms,
      }),
    );
    toast.success("Rooms saved");
  }

  return (
    <div className="space-y-4 md:col-span-2">
      <div>
        <h4 className="font-display text-base font-bold tracking-tight">Rooms</h4>
        <p className="text-sm text-muted-foreground">
          Rooms (Value changes below) needs Hard save so a typed count cannot drop a room card by
          accident. Basement, attic, foyer, and mud room are quantity blanks like closets. Finished,
          unfinished, stairs, and basement doors sit with basement. Addition is a checkbox.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {HOUSE_ROOM_COUNT_FIELDS.map((field) => (
          <div
            key={field.key}
            className={cn(
              "space-y-1 rounded-md bg-muted/50 px-2.5 py-2 shadow-[var(--shadow-border)]",
              field.key === "room_count" && "col-span-2 sm:col-span-3",
            )}
          >
            <Label htmlFor={`fact-${field.key}`}>{field.label}</Label>
            <div className={field.key === "room_count" ? "flex flex-wrap items-center gap-2" : undefined}>
              <Input
                id={`fact-${field.key}`}
                inputMode="numeric"
                value={counts[field.key]}
                placeholder={field.placeholder}
                disabled={disabled}
                className={field.key === "room_count" ? "max-w-32" : undefined}
                onChange={(e) => setCounts((cur) => ({ ...cur, [field.key]: e.target.value }))}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  setCounts((cur) => ({ ...cur, [field.key]: value }));
                  if (field.key === "room_count") return;
                  void onSave(field.key, value);
                  if (
                    field.key === "foyer" ||
                    field.key === "mud_room" ||
                    field.key === "basement" ||
                    field.key === "attic"
                  ) {
                    persistRooms(
                      roomsFromCounts({
                        rooms: appliedRooms,
                        foyer: field.key === "foyer" ? value : counts.foyer,
                        mudRoom: field.key === "mud_room" ? value : counts.mud_room,
                        basement: field.key === "basement" ? value : counts.basement,
                        attic: field.key === "attic" ? value : counts.attic,
                        addition,
                        existing: rooms,
                      }),
                    );
                  }
                }}
              />
              {field.key === "room_count" ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={disabled || !roomsDirty}
                  onClick={() => applyRoomCount()}
                >
                  Hard save
                </Button>
              ) : null}
            </div>
            {field.key === "room_count" && roomsDirty ? (
              <p className="text-xs text-muted-foreground">
                Cards below stay until Hard save. A lower number can drop a room.
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {HOUSE_BASEMENT_DETAIL_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1 rounded-md bg-muted/50 px-2.5 py-2 shadow-[var(--shadow-border)]">
            <Label htmlFor={`fact-${field.key}`}>{field.label}</Label>
            <Input
              id={`fact-${field.key}`}
              inputMode="numeric"
              value={basementDetails[field.key]}
              placeholder={field.placeholder}
              disabled={disabled}
              onChange={(e) => setBasementDetails((cur) => ({ ...cur, [field.key]: e.target.value }))}
              onBlur={(e) => {
                const value = e.target.value.trim();
                setBasementDetails((cur) => ({ ...cur, [field.key]: value }));
                void onSave(field.key, value);
              }}
            />
          </div>
        ))}
      </div>

      <div className="space-y-2 rounded-md bg-muted/50 px-2.5 py-2 shadow-[var(--shadow-border)]">
        <p className="text-xs font-medium">Drainage</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {HOUSE_DRAINAGE_OPTIONS.map((choice) => (
            <button
              key={choice.value}
              type="button"
              disabled={disabled}
              className={cn(
                "min-h-11 rounded-md px-3 text-sm shadow-[var(--shadow-border)]",
                drainage === choice.value ? "bg-primary text-primary-foreground" : "bg-card",
              )}
              onClick={() => {
                const value = drainage === choice.value ? "" : choice.value;
                setDrainage(value);
                void onSave("drainage", value);
              }}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {HOUSE_ROOM_SHARED_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1 rounded-md bg-muted/50 px-2.5 py-2 shadow-[var(--shadow-border)]">
            <Label htmlFor={`fact-${field.key}`}>{field.label}</Label>
            <Input
              id={`fact-${field.key}`}
              value={shared[field.key]}
              placeholder={field.placeholder}
              disabled={disabled}
              onChange={(e) => setShared((cur) => ({ ...cur, [field.key]: e.target.value }))}
              onBlur={(e) => {
                const value = e.target.value.trim();
                setShared((cur) => ({ ...cur, [field.key]: value }));
                void onSave(field.key, value);
              }}
            />
          </div>
        ))}
        {HOUSE_YESNO_FIELDS.map((field) => (
          <label
            key={field.key}
            htmlFor={`fact-${field.key}`}
            className="flex min-h-11 items-center gap-2 rounded-md bg-muted/50 px-2.5 py-2 text-sm shadow-[var(--shadow-border)]"
          >
            <input
              id={`fact-${field.key}`}
              type="checkbox"
              className="size-4 shrink-0"
              disabled={disabled}
              checked={addition === "yes"}
              onChange={(e) => {
                const value = e.target.checked ? "yes" : "";
                setAddition(value);
                void onSave(field.key, value);
                persistRooms(
                  roomsFromCounts({
                    rooms: appliedRooms,
                    foyer: counts.foyer,
                    mudRoom: counts.mud_room,
                    basement: counts.basement,
                    attic: counts.attic,
                    addition: value,
                    existing: rooms,
                  }),
                );
              }}
            />
            {field.label}
          </label>
        ))}
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
                onRemove={() => removeRoom(room)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Hard save a room count, or put a number on foyer, mud room, basement, or attic, to add
          flooring cards.
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          const n = String((Number.parseInt(appliedRooms, 10) || 0) + 1);
          setCounts((cur) => ({ ...cur, room_count: n }));
          setAppliedRooms(n);
          void onSave("room_count", n);
          persistRooms(
            roomsFromCounts({
              rooms: n,
              foyer: counts.foyer,
              mudRoom: counts.mud_room,
              basement: counts.basement,
              attic: counts.attic,
              addition,
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
  onRemove,
}: {
  room: HouseRoomFloor;
  disabled?: boolean;
  onChange: (patch: Partial<HouseRoomFloor>) => void;
  onCommit: (patch: Partial<HouseRoomFloor>) => void;
  onRemove: () => void;
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
        <div className="flex flex-wrap items-start gap-2">
          <Input
            value={room.name}
            disabled={disabled}
            aria-label={`${room.name} name`}
            className="min-w-0 flex-1"
            onChange={(e) => onChange({ name: e.target.value })}
            onBlur={(e) => onCommit({ name: e.target.value })}
          />
          <label
            htmlFor={`remove-room-${room.id}`}
            className="flex min-h-10 shrink-0 items-center gap-2 rounded-md px-2 text-sm"
          >
            <input
              id={`remove-room-${room.id}`}
              type="checkbox"
              className="size-4 shrink-0"
              disabled={disabled}
              checked={false}
              onChange={(e) => {
                if (e.target.checked) onRemove();
              }}
            />
            Remove room
          </label>
        </div>
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
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`paint-${room.id}`}>Paint color</Label>
            <Input
              id={`paint-${room.id}`}
              value={room.paint}
              placeholder="SW 7029 Agreeable Gray"
              disabled={disabled}
              onChange={(e) => onChange({ paint: e.target.value })}
              onBlur={(e) => onCommit({ paint: e.target.value })}
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
