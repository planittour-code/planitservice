import { useMutation } from "@tanstack/react-query";
import { Camera, ChevronDown, Copy, Mail } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CATEGORY_PHOTO,
  FIELD_CATALOG,
  FIELD_GROUPS,
  HOUSE_QUOTE_KEYS,
  HOUSE_ROOM_EDITOR_KEYS,
  HOUSE_ROOMS_JSON_KEY,
  PHOTO_CATEGORIES,
} from "@/lib/housefile/fields";
import { HouseRoomsEditor } from "@/components/house-rooms";
import { shortDate } from "@/lib/housefile/format";
import { compressImage } from "@/lib/housefile/image";
import { invitationLetter, invitationSubject } from "@/lib/housefile/invite";
import { jobWorkType } from "@/lib/housefile/quote";
import type { KnownProvider } from "@/lib/housefile/types";
import {
  addPhotoContractor,
  addPhotoPublic,
  deletePhotoContractor,
  deletePhotoPublic,
  upsertFactContractor,
  upsertFactPublic,
} from "@/lib/housefile/server";
import type { HouseFile, JobSpec, JobWithSpecs } from "@/lib/housefile/types";
import { cn } from "@/lib/utils";

export function RecordSection({
  title,
  blurb,
  photo,
  countLabel,
  chips,
  children,
  id,
  defaultOpen,
}: {
  title: string;
  blurb: string;
  photo?: string;
  countLabel?: string;
  chips?: ReactNode;
  children: ReactNode;
  id?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <details
      id={id}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="group overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3 sm:p-4 [&::-webkit-details-marker]:hidden">
        {photo ? (
          <img src={photo} alt="" className="size-14 shrink-0 rounded-md object-cover sm:size-16" />
        ) : null}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
            {countLabel ? (
              <p className="text-xs font-semibold tabular-nums text-muted-foreground">{countLabel}</p>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{blurb}</p>
          {chips}
        </div>
        <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-3 border-t border-border p-3 sm:p-4">{children}</div>
    </details>
  );
}

export function Completeness({ filled, total }: { filled: number; total: number }) {
  const pct = total ? Math.round((filled / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div
        className="size-12 shrink-0 rounded-full"
        style={{
          background: `conic-gradient(var(--color-primary) ${pct}%, var(--color-muted) 0)`,
        }}
      >
        <div className="grid size-full place-items-center p-1.5">
          <div className="grid size-full place-items-center rounded-full bg-card text-sm font-medium tabular-nums">
            {pct}%
          </div>
        </div>
      </div>
      <div>
        <p className="font-medium">
          <span className="tabular-nums">{filled}</span> of{" "}
          <span className="tabular-nums">{total}</span> house facts on file
        </p>
        <p className="text-sm text-muted-foreground">
          Missing facts make the next quote slower and less accurate.
        </p>
      </div>
    </div>
  );
}

export function missingFieldLabels(file: HouseFile) {
  const byKey = Object.fromEntries(file.facts.map((f) => [f.field_key, f]));
  return FIELD_CATALOG.filter((f) => f.key !== HOUSE_ROOMS_JSON_KEY && !byKey[f.key]?.value);
}

export function MissingChips({
  file,
  limit,
  href,
}: {
  file: HouseFile;
  limit?: number;
  href?: string;
}) {
  const missing = missingFieldLabels(file);
  if (!missing.length) {
    return (
      <p className="text-sm text-muted-foreground">Every catalog field for this house is filled.</p>
    );
  }
  const groups = FIELD_GROUPS.map((group) => ({
    group,
    fields: missing.filter((f) => f.group === group.id),
  })).filter((row) => row.fields.length);
  const chipClass =
    "inline-flex min-h-8 items-center rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground";
  let remaining = limit ?? missing.length;
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Still needed for future quotes</p>
      {groups.map(({ group, fields }) => {
        if (remaining <= 0) return null;
        const shown = fields.slice(0, remaining);
        remaining -= shown.length;
        return (
          <div key={group.id} className="space-y-1">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {group.label}
            </p>
            <ul className="flex flex-wrap gap-2">
              {shown.map((f) => (
                <li key={f.key}>
                  {href ? (
                    <a href={href} className={chipClass}>
                      {f.label}
                    </a>
                  ) : (
                    <span className={chipClass}>{f.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function PhotoGrid({
  file,
  mode,
  token,
  onChanged,
}: {
  file: HouseFile;
  mode: "homeowner" | "contractor";
  token?: string;
  onChanged: () => void;
}) {
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("exterior");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ file: File; preview: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function commit(fileObj: File, nextCaption: string, nextCategory: string) {
    setBusy(true);
    try {
      const src = await compressImage(fileObj);
      if (mode === "homeowner") {
        if (!token) throw new Error("Missing house token");
        await addPhotoPublic({
          data: { token, src, caption: nextCaption, category: nextCategory },
        });
      } else {
        await addPhotoContractor({
          data: { propertyId: file.property.id, src, caption: nextCaption, category: nextCategory },
        });
      }
      setCaption("");
      toast.success("Photo added to the property record");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add photo");
    } finally {
      setBusy(false);
      setPending((cur) => {
        if (cur?.preview) URL.revokeObjectURL(cur.preview);
        return null;
      });
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onPick(f: File | undefined) {
    if (!f) return;
    const preview = URL.createObjectURL(f);
    setPending({ file: f, preview });
  }

  const thumbs = file.photos.slice(0, 5);
  return (
    <RecordSection
      title="Photos"
      blurb="Start here. Add elevations, rooms, and equipment tags. These stay with the address."
      photo={file.photos[0]?.src ?? CATEGORY_PHOTO.house}
      countLabel={`${file.photos.length} on file`}
      chips={
        thumbs.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {thumbs.map((p) => (
              <li key={p.id}>
                <img
                  src={p.src}
                  alt=""
                  className="size-8 rounded-full object-cover shadow-[var(--shadow-border)]"
                />
              </li>
            ))}
            {file.photos.length > thumbs.length ? (
              <li className="grid size-8 place-items-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                +{file.photos.length - thumbs.length}
              </li>
            ) : null}
          </ul>
        ) : undefined
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {file.photos.map((p) => (
          <figure key={p.id} className="overflow-hidden rounded-lg bg-card shadow-[var(--shadow-border)]">
            <img src={p.src} alt={p.caption || p.category} className="aspect-[4/3] w-full object-cover" />
            <figcaption className="space-y-1 px-2 py-1.5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-foreground">{p.caption || "Untitled"}</span>
                <Badge variant="muted">{p.category}</Badge>
              </div>
              {mode === "homeowner" && token ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 w-full text-xs text-destructive"
                  onClick={async () => {
                    if (!window.confirm("Remove this photo from the record?")) return;
                    try {
                      await deletePhotoPublic({ data: { token, photoId: p.id } });
                      toast.success("Photo removed");
                      onChanged();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not remove");
                    }
                  }}
                >
                  Remove
                </Button>
              ) : mode === "contractor" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 w-full text-xs text-destructive"
                  onClick={async () => {
                    if (!window.confirm("Remove this photo from the record?")) return;
                    try {
                      await deletePhotoContractor({
                        data: { propertyId: file.property.id, photoId: p.id },
                      });
                      toast.success("Photo removed");
                      onChanged();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not remove");
                    }
                  }}
                >
                  Remove
                </Button>
              ) : null}
            </figcaption>
          </figure>
        ))}
        <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-card/60 px-3 py-4 text-center text-sm text-muted-foreground hover:bg-muted">
          <Camera className="size-5 text-primary" />
          <span>{busy ? "Adding…" : "Add a photo"}</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(e) => onPick(e.target.files?.[0])}
          />
        </label>
      </div>
      {pending && (
        <div className="grid gap-2 rounded-xl bg-card p-3 shadow-[var(--shadow-border)] sm:grid-cols-[8rem_1fr]">
          <img src={pending.preview} alt="" className="aspect-[4/3] w-full rounded-md object-cover" />
          <div className="space-y-2">
            <p className="text-sm font-medium">Caption this photo, then add it to the house.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="cap">Caption</Label>
                <Input
                  id="cap"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="South elevation, 2026"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cat">Category</Label>
                <select
                  id="cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex h-9 w-full rounded-md bg-background px-2.5 text-sm shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {PHOTO_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={() => void commit(pending.file, caption, category)}
              >
                {busy ? "Adding…" : "Add to property record"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  URL.revokeObjectURL(pending.preview);
                  setPending(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </RecordSection>
  );
}

export function FactsPanel({
  file,
  mode,
  token,
  onChanged,
}: {
  file: HouseFile;
  mode: "homeowner" | "contractor";
  token?: string;
  onChanged: () => void;
}) {
  const byKey = Object.fromEntries(file.facts.map((f) => [f.field_key, f]));

  const save = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      if (mode === "homeowner") {
        if (!token) throw new Error("Missing house token");
        await upsertFactPublic({ data: { token, fieldKey: key, value } });
      } else {
        await upsertFactContractor({
          data: { propertyId: file.property.id, fieldKey: key, value },
        });
      }
    },
    onSuccess: (_data, vars) => {
      const roomKey = (HOUSE_ROOM_EDITOR_KEYS as readonly string[]).includes(vars.key);
      if (!roomKey) toast.success("Property Record updated");
      if (vars.key !== HOUSE_ROOMS_JSON_KEY) onChanged();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save"),
  });

  const filledGroups = FIELD_GROUPS.filter((group) =>
    FIELD_CATALOG.some(
      (f) => f.group === group.id && f.key !== HOUSE_ROOMS_JSON_KEY && byKey[f.key]?.value,
    ),
  );
  const [houseOpen, setHouseOpen] = useState(mode === "homeowner");
  return (
    <RecordSection
      title="House data"
      blurb="Same categories as a quote. Fill what you know. Leave the rest — a contractor can add it on site."
      defaultOpen={mode === "homeowner"}
      photo={CATEGORY_PHOTO.house}
      countLabel={`${file.filledCount} of ${file.totalCount} on file`}
      chips={
        filledGroups.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {filledGroups.map((group) => (
              <li
                key={group.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted py-0.5 pr-2.5 pl-0.5 text-xs font-semibold"
              >
                <img src={group.photo} alt="" className="size-6 rounded-full object-cover" />
                {group.label}
              </li>
            ))}
          </ul>
        ) : undefined
      }
    >
      {FIELD_GROUPS.map((group) => {
        const fields = FIELD_CATALOG.filter((f) => f.group === group.id);
        if (!fields.length) return null;
        const gridFields =
          group.id === "house"
            ? fields.filter((f) => !(HOUSE_ROOM_EDITOR_KEYS as readonly string[]).includes(f.key))
            : fields;
        const quoteGrid = gridFields.filter((f) =>
          (HOUSE_QUOTE_KEYS as readonly string[]).includes(f.key),
        );
        const restGrid = gridFields.filter(
          (f) => !(HOUSE_QUOTE_KEYS as readonly string[]).includes(f.key),
        );
        const countable = fields.filter((f) => f.key !== HOUSE_ROOMS_JSON_KEY);
        const filled = countable.filter((f) => Boolean(byKey[f.key]?.value)).length;
        const quoteFields =
          group.id === "house"
            ? fields.filter((f) => (HOUSE_QUOTE_KEYS as readonly string[]).includes(f.key))
            : [];
        return (
          <details
            key={group.id}
            open={group.id === "house" ? houseOpen : undefined}
            onToggle={
              group.id === "house"
                ? (e) => setHouseOpen(e.currentTarget.open)
                : undefined
            }
            className="group/fact overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 p-3 sm:p-4 [&::-webkit-details-marker]:hidden">
              <img
                src={group.photo}
                alt=""
                className="size-14 shrink-0 rounded-md object-cover sm:size-16"
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-lg font-bold tracking-tight">{group.label}</h3>
                  <p className="text-xs font-semibold tabular-nums text-muted-foreground">
                    {filled} of {countable.length} on file
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">{group.blurb}</p>
                {quoteFields.length ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {quoteFields.map((field) => (
                      <li
                        key={field.key}
                        className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-semibold"
                      >
                        {field.label}
                      </li>
                    ))}
                    {group.id === "house" ? (
                      <li className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                        Rooms
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
              <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open/fact:rotate-180" aria-hidden />
            </summary>
            <div className="space-y-3 border-t border-border p-3 sm:p-4">
              <div className="grid gap-2 md:grid-cols-2">
                {(group.id === "house" ? quoteGrid : gridFields).map((field) => (
                  <FactInput
                    key={`${field.key}-${byKey[field.key]?.value ?? ""}`}
                    id={field.key}
                    label={field.label}
                    hint={field.hint}
                    placeholder={field.placeholder}
                    defaultValue={byKey[field.key]?.value ?? ""}
                    source={byKey[field.key]?.source}
                    empty={!byKey[field.key]?.value}
                    disabled={save.isPending}
                    onSave={(value) => save.mutate({ key: field.key, value })}
                  />
                ))}
                {group.id === "house" ? (
                  <HouseRoomsEditor
                    facts={byKey}
                    disabled={save.isPending}
                    onSave={(key, value) => save.mutateAsync({ key, value })}
                  />
                ) : null}
                {group.id === "house"
                  ? restGrid.map((field) => (
                      <FactInput
                        key={`${field.key}-${byKey[field.key]?.value ?? ""}`}
                        id={field.key}
                        label={field.label}
                        hint={field.hint}
                        placeholder={field.placeholder}
                        defaultValue={byKey[field.key]?.value ?? ""}
                        source={byKey[field.key]?.source}
                        empty={!byKey[field.key]?.value}
                        disabled={save.isPending}
                        onSave={(value) => save.mutate({ key: field.key, value })}
                      />
                    ))
                  : null}
              </div>
            </div>
          </details>
        );
      })}
    </RecordSection>
  );
}

export function MissingFactsPreview({
  file,
  mode,
  token,
  onChanged,
  limit = 6,
}: {
  file: HouseFile;
  mode: "homeowner" | "contractor";
  token?: string;
  onChanged: () => void;
  limit?: number;
}) {
  const missing = missingFieldLabels(file).slice(0, limit);
  const save = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      if (mode === "homeowner") {
        if (!token) throw new Error("Missing house token");
        await upsertFactPublic({ data: { token, fieldKey: key, value } });
      } else {
        await upsertFactContractor({
          data: { propertyId: file.property.id, fieldKey: key, value },
        });
      }
    },
    onSuccess: () => {
      toast.success("Property Record updated");
      onChanged();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save"),
  });
  if (!missing.length) return null;
  const groups = FIELD_GROUPS.map((group) => ({
    group,
    fields: missing.filter((f) => f.group === group.id),
  })).filter((row) => row.fields.length);
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-medium">Missing house data</h2>
        <p className="text-sm text-muted-foreground">
          Grouped the same way as a quote. Fill what you know while the draft is open.
        </p>
      </div>
      {groups.map(({ group, fields }) => (
        <div key={group.id} className="space-y-1.5">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {group.label}
          </h3>
          <div className="grid gap-2 md:grid-cols-2">
            {fields.map((field) => (
              <FactInput
                key={field.key}
                id={field.key}
                label={field.label}
                hint={field.hint}
                placeholder={field.placeholder}
                defaultValue=""
                empty
                disabled={save.isPending}
                onSave={(value) => save.mutate({ key: field.key, value })}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function FactInput({
  id,
  label,
  hint,
  placeholder,
  defaultValue,
  source,
  empty,
  disabled,
  onSave,
}: {
  id?: string;
  label: string;
  hint: string;
  placeholder: string;
  defaultValue: string;
  source?: string;
  empty?: boolean;
  disabled?: boolean;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const dirty = value !== defaultValue;
  const inputId = id ? `fact-${id}` : undefined;
  return (
    <div
      className={cn(
        "space-y-1 rounded-md px-2.5 py-2 shadow-[var(--shadow-border)]",
        empty ? "bg-muted/50" : "bg-background",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={inputId}>{label}</Label>
        {source ? (
          <span className="text-xs text-muted-foreground">
            {source === "homeowner" ? "You" : "Contractor"}
          </span>
        ) : empty ? (
          <span className="text-xs text-muted-foreground">Not on file</span>
        ) : null}
      </div>
      <Input
        id={inputId}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (dirty) onSave(value);
        }}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function KnownProviders({
  providers,
}: {
  providers: KnownProvider[];
}) {
  return (
    <RecordSection
      title="Known shops"
      blurb="Shops that already worked this address. Call them back for repeat work."
      photo={CATEGORY_PHOTO.house}
      countLabel={`${providers.length} on file`}
      chips={
        providers.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {providers.slice(0, 8).map((shop) => (
              <li key={shop.companyId}>
                {shop.logo_src ? (
                  <img
                    src={shop.logo_src}
                    alt={shop.name}
                    title={shop.name}
                    className="size-8 rounded-full bg-background object-contain p-0.5 shadow-[var(--shadow-border)]"
                  />
                ) : (
                  <span
                    title={shop.name}
                    className="grid size-8 place-items-center rounded-full bg-secondary text-[11px] font-bold text-white"
                  >
                    {shop.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : undefined
      }
    >
      {providers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No shops on file yet. Accepted estimates and completed jobs land here.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md bg-background shadow-[var(--shadow-border)]">
          {providers.map((shop) => (
            <li key={shop.companyId} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                {shop.logo_src ? (
                  <img
                    src={shop.logo_src}
                    alt=""
                    className="size-10 shrink-0 rounded-md bg-background object-contain p-0.5"
                  />
                ) : (
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-sm font-bold text-white">
                    {shop.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div>
                  <p className="font-medium">{shop.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {shop.lastWork} · {shortDate(shop.lastAt)}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {[shop.phone, shop.email].filter(Boolean).join(" · ") || "On the File"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </RecordSection>
  );
}

export function JobTimeline({ file }: { file: HouseFile }) {
  const categories = file.jobs
    .map((job) => jobWorkType(job))
    .filter((w): w is NonNullable<typeof w> => Boolean(w));
  const unique = [...new Map(categories.map((w) => [w.id, w])).values()];
  return (
    <RecordSection
      title="Jobs at this address"
      blurb="Colors, products, and measurements stay with the house."
      photo={unique[0] ? CATEGORY_PHOTO[unique[0].id] ?? CATEGORY_PHOTO.house : CATEGORY_PHOTO.house}
      countLabel={`${file.jobs.length} on file`}
      chips={
        unique.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {unique.map((work) => (
              <li
                key={work.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted py-0.5 pr-2.5 pl-0.5 text-xs font-semibold"
              >
                <img
                  src={CATEGORY_PHOTO[work.id] ?? CATEGORY_PHOTO.house}
                  alt=""
                  className="size-6 rounded-full object-cover"
                />
                {work.name}
              </li>
            ))}
          </ul>
        ) : undefined
      }
    >
      {file.jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No completed jobs yet. Accepted work will land here.</p>
      ) : (
        <ol className="space-y-2">
          {file.jobs.map((job) => {
            const work = jobWorkType(job);
            return (
              <li key={job.id} className="rounded-lg bg-background p-3 shadow-[var(--shadow-border)]">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {work ? (
                      <img
                        src={CATEGORY_PHOTO[work.id] ?? CATEGORY_PHOTO.house}
                        alt=""
                        className="size-8 rounded-md object-cover"
                      />
                    ) : null}
                    <h3 className="font-display text-lg font-medium">{job.title}</h3>
                  </div>
                  <time className="text-sm text-muted-foreground">{shortDate(job.completed_at)}</time>
                </div>
                {job.summary && <p className="mt-1 text-sm text-muted-foreground">{job.summary}</p>}
                {job.specs.length > 0 && (
                  <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                    {job.specs.map((spec) => (
                      <div key={spec.id} className="rounded-md bg-muted/60 px-3 py-2">
                        <dt className="text-xs tracking-wide text-muted-foreground uppercase">{spec.label}</dt>
                        <dd className="text-sm font-medium">{spec.value}</dd>
                        {spec.location_note && (
                          <dd className="text-xs text-muted-foreground">{spec.location_note}</dd>
                        )}
                        {spec.manufacturer && (
                          <dd className="text-xs text-muted-foreground">
                            {spec.manufacturer}
                            {spec.product_name ? ` · ${spec.product_name}` : ""}
                          </dd>
                        )}
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </RecordSection>
  );
}

export function PreviousJobsStrip({ jobs }: { jobs: JobWithSpecs[] }) {
  if (!jobs.length) return null;
  return (
    <aside className="rounded-xl bg-muted/50 px-4 py-3">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">
        Previous work at this address
      </p>
      <ul className="mt-2 space-y-1">
        {jobs.map((job) => (
          <li key={job.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">{job.title}</span>
            <time className="text-muted-foreground">{shortDate(job.completed_at)}</time>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function manufacturerMark(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "M";
}

export function WarrantyList({ file }: { file: HouseFile }) {
  const items: (JobSpec & { jobTitle: string; completed: string })[] = [];
  for (const job of file.jobs) {
    for (const spec of job.specs) {
      if (spec.warranty_terms || spec.warranty_years) {
        items.push({ ...spec, jobTitle: job.title, completed: job.completed_at });
      }
    }
  }
  const makers = [
    ...new Map(
      items
        .map((w) => w.manufacturer?.trim())
        .filter((name): name is string => Boolean(name))
        .map((name) => [name.toLowerCase(), name]),
    ).values(),
  ];
  return (
    <RecordSection
      title="Manufacturer warranties"
      blurb="Tied to this address, not a PDF in a drawer."
      photo={CATEGORY_PHOTO.systems}
      countLabel={`${items.length} on file`}
      chips={
        makers.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {makers.map((name) => (
              <li
                key={name}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted py-0.5 pr-2.5 pl-0.5 text-xs font-semibold"
              >
                <span className="grid size-6 place-items-center rounded-full bg-secondary text-[10px] font-bold text-white">
                  {manufacturerMark(name)}
                </span>
                {name}
              </li>
            ))}
          </ul>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          When a job is marked complete, product warranties are copied here.
        </p>
      ) : (
      <ul className="space-y-2">
        {items.map((w) => (
          <li key={w.id} className="rounded-md bg-background px-3 py-2 shadow-[var(--shadow-border)]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">
                {w.manufacturer ? `${w.manufacturer} ` : ""}
                {w.product_name || w.label}
              </p>
              {w.warranty_expires ? (
                <span className="text-sm tabular-nums text-muted-foreground">
                  Through {shortDate(w.warranty_expires)}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">See terms</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{w.warranty_terms}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              From {w.jobTitle} · {shortDate(w.completed)}
            </p>
          </li>
        ))}
      </ul>
      )}
    </RecordSection>
  );
}

function absoluteUrl(path: string) {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function CopyLink({ path, label }: { path: string; label: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(absoluteUrl(path));
        toast.success("Link copied");
      }}
    >
      <Copy className="size-3.5" />
      {label}
    </Button>
  );
}

export function InvitationLetter({
  email,
  name,
  address,
  company,
  invitePath,
  housePath,
  proposalPath,
}: {
  email: string;
  name: string;
  address: string;
  company: string;
  invitePath: string;
  housePath: string;
  proposalPath?: string;
}) {
  const inviteUrl = absoluteUrl(invitePath);
  const proposalUrl = proposalPath ? absoluteUrl(proposalPath) : undefined;
  const body = invitationLetter({
    name,
    address,
    company,
    inviteUrl,
    proposalUrl,
  });
  const subject = invitationSubject(company, address);

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Invitation</p>
          <p className="font-medium">To {name}</p>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/60 px-4 py-3 font-sans text-sm leading-relaxed">
          {body}
        </pre>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            }}
          >
            <Mail className="size-3.5" />
            Open in email
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(body);
              toast.success("Invitation copied");
            }}
          >
            <Copy className="size-3.5" />
            Copy invitation
          </Button>
          <CopyLink path={invitePath} label="Copy house account" />
          {proposalPath && <CopyLink path={proposalPath} label="Copy first draft" />}
          <CopyLink path={housePath} label="Copy property record" />
        </div>
      </CardContent>
    </Card>
  );
}

export function InviteMail({
  email,
  name,
  address,
  company,
  housePath,
  proposalPath,
  invitePath,
}: {
  email: string;
  name: string;
  address: string;
  company: string;
  housePath: string;
  proposalPath?: string;
  invitePath?: string;
}) {
  return (
    <Button
      type="button"
      onClick={() => {
        const inviteUrl = absoluteUrl(invitePath || housePath);
        const proposalUrl = proposalPath ? absoluteUrl(proposalPath) : undefined;
        const subject = encodeURIComponent(invitationSubject(company, address));
        const body = encodeURIComponent(
          invitationLetter({ name, address, company, inviteUrl, proposalUrl }),
        );
        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
      }}
    >
      <Mail className="size-3.5" />
      Email the invitation
    </Button>
  );
}

export function SectionRule({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />;
}
