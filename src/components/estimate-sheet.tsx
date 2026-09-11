import { Camera, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PriceBookItem } from "@/lib/housefile/book";
import {
  applyCatalogToLine,
  blankEstimateLine,
  blankOptionalLine,
  CUSTOM_OPTION_ID,
  estimateTotal,
  lineAmount,
  type CatalogLine,
  type EstimateLine,
} from "@/lib/housefile/estimate-lines";
import { money } from "@/lib/housefile/format";
import { compressImage } from "@/lib/housefile/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function EstimateSheet({
  book,
  catalog,
  lines,
  onChange,
}: {
  book: PriceBookItem[];
  catalog: CatalogLine[];
  lines: EstimateLine[];
  onChange: (next: EstimateLine[]) => void;
  workId?: string;
  paintScope?: string;
}) {
  const items = book.filter((b) => b.active !== false);
  const core = lines.filter((l) => !l.optionId);
  const optional = lines.filter((l) => l.optionId);
  const total = estimateTotal(lines);
  const [optionalOpen, setOptionalOpen] = useState(optional.length > 0);

  useEffect(() => {
    if (optional.length > 0) setOptionalOpen(true);
  }, [optional.length]);

  function patch(id: string, next: Partial<EstimateLine>) {
    onChange(lines.map((row) => (row.id === id ? { ...row, ...next } : row)));
  }

  function pickCatalog(id: string, pick: CatalogLine) {
    onChange(lines.map((l) => (l.id === id ? applyCatalogToLine(l, pick, items) : l)));
  }

  async function addPhotos(id: string, files: FileList | null) {
    if (!files?.length) return;
    const row = lines.find((l) => l.id === id);
    if (!row) return;
    try {
      const added: string[] = [];
      for (const file of Array.from(files).slice(0, 8)) {
        added.push(await compressImage(file, 1000));
      }
      patch(id, { photos: [...(row.photos ?? []), ...added] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read photo");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-medium tracking-tight">Line items</h2>
        <p className="text-sm text-muted-foreground">
          Search this shop’s Materials book. A name that is not in the list stays on the quote.
          Amount is quantity × price.
        </p>
      </div>
      <div className="space-y-3">
        {core.map((row) => (
          <LineCard
            key={row.id}
            row={row}
            catalog={catalog}
            canRemove={core.length > 1}
            onPatch={(next) => patch(row.id, next)}
            onPick={(pick) => pickCatalog(row.id, pick)}
            onPhotos={(files) => void addPhotos(row.id, files)}
            onRemove={() => onChange(lines.filter((l) => l.id !== row.id))}
            onType={(optionalNext) =>
              patch(row.id, { optionId: optionalNext ? CUSTOM_OPTION_ID : undefined })
            }
          />
        ))}
      </div>
      <details
        className="rounded-xl bg-card p-3 text-sm shadow-[var(--shadow-border)]"
        open={optionalOpen}
        onToggle={(e) => setOptionalOpen(e.currentTarget.open)}
      >
        <summary className="cursor-pointer font-medium">
          Optional work{optional.length ? ` (${optional.length})` : ""}
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted-foreground">
            Type extras the homeowner can take or leave. Change the type back to a line item, or
            remove the row with (x).
          </p>
          {optional.map((row) => (
            <LineCard
              key={row.id}
              row={row}
              catalog={catalog}
              canRemove
              onPatch={(next) => patch(row.id, next)}
              onPick={(pick) => pickCatalog(row.id, pick)}
              onPhotos={(files) => void addPhotos(row.id, files)}
              onRemove={() => onChange(lines.filter((l) => l.id !== row.id))}
              onType={(optionalNext) =>
                patch(row.id, { optionId: optionalNext ? CUSTOM_OPTION_ID : undefined })
              }
            />
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOptionalOpen(true);
              onChange([...lines, blankOptionalLine()]);
            }}
          >
            Add optional line
          </Button>
        </div>
      </details>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background/95 p-3 shadow-[var(--shadow-border)] sticky bottom-0 z-20 -mx-4 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <Button type="button" variant="outline" onClick={() => onChange([...lines, blankEstimateLine()])}>
          Add a line
        </Button>
        <p className="font-display text-xl font-medium tabular-nums sm:text-2xl">
          Total Amount {money(total)}
        </p>
      </div>
    </div>
  );
}

function LineCard({
  row,
  catalog,
  canRemove,
  onPatch,
  onPick,
  onPhotos,
  onRemove,
  onType,
}: {
  row: EstimateLine;
  catalog: CatalogLine[];
  canRemove: boolean;
  onPatch: (next: Partial<EstimateLine>) => void;
  onPick: (pick: CatalogLine) => void;
  onPhotos: (files: FileList | null) => void;
  onRemove: () => void;
  onType: (optional: boolean) => void;
}) {
  const heading = row.item.trim() || "New line";
  const photoInput = useRef<HTMLInputElement>(null);
  const isOptional = Boolean(row.optionId);
  return (
    <div className="space-y-2 rounded-lg bg-background p-2.5 shadow-[var(--shadow-border)] sm:p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate font-medium">{heading}</p>
        <div className="flex shrink-0 items-center gap-1">
          <select
            value={isOptional ? "optional" : "line"}
            aria-label="Line type"
            className="flex h-9 rounded-md bg-card px-2.5 text-sm shadow-[var(--shadow-border)] outline-none"
            onChange={(e) => onType(e.target.value === "optional")}
          >
            <option value="line">Line item</option>
            <option value="optional">Optional work</option>
          </select>
          <Button type="button" size="sm" variant="outline" onClick={() => photoInput.current?.click()}>
            <Camera className="size-4" />
            Add photo
          </Button>
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              onPhotos(e.target.files);
              e.target.value = "";
            }}
          />
          {canRemove && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-11"
              aria-label="Remove line"
              title="Remove line"
              onClick={onRemove}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`item-${row.id}`}>Item</Label>
        <ItemSearch
          id={`item-${row.id}`}
          value={row.item}
          catalog={catalog}
          onChange={(item) => onPatch({ item, bookId: "" })}
          onPick={onPick}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`desc-${row.id}`}>Description</Label>
        <Textarea
          id={`desc-${row.id}`}
          rows={3}
          value={row.description}
          onChange={(e) => onPatch({ description: e.target.value })}
          placeholder="Scope, prep, product, notes the homeowner should see"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <NumField label="Quantity" value={row.qty} onChange={(v) => onPatch({ qty: v })} />
        <NumField label="Cost" value={row.cost} onChange={(v) => onPatch({ cost: v })} />
        <NumField label="Price" value={row.price} onChange={(v) => onPatch({ price: v })} />
        <div className="space-y-1">
          <Label>Amount</Label>
          <p className="flex h-9 items-center tabular-nums">{money(lineAmount(row))}</p>
        </div>
      </div>
      {(row.photos ?? []).length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {row.photos.map((src, i) => (
            <div key={`${row.id}-ph-${i}`} className="relative overflow-hidden rounded-lg bg-muted">
              <img src={src} alt="" className="aspect-square w-full object-cover" />
              <button
                type="button"
                className="absolute top-1 right-1 rounded bg-background/90 px-2 text-xs"
                onClick={() => onPatch({ photos: row.photos.filter((_, idx) => idx !== i) })}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemSearch({
  id,
  value,
  catalog,
  onChange,
  onPick,
}: {
  id: string;
  value: string;
  catalog: CatalogLine[];
  onChange: (item: string) => void;
  onPick: (pick: CatalogLine) => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    const list = q
      ? catalog.filter(
          (row) =>
            row.name.toLowerCase().includes(q) ||
            row.description.toLowerCase().includes(q),
        )
      : catalog;
    return list.slice(0, 12);
  }, [catalog, value]);

  useEffect(() => {
    setHighlight(0);
  }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function choose(pick: CatalogLine) {
    onPick(pick);
    setOpen(false);
  }

  return (
    <div ref={wrap} className="relative">
      <Input
        id={id}
        value={value}
        autoComplete="off"
        placeholder="Search materials"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            setOpen(true);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((i) => Math.min(i + 1, Math.max(matches.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && open && matches[highlight]) {
            e.preventDefault();
            choose(matches[highlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && matches.length > 0 && (
        <ul
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md bg-card py-1 shadow-[var(--shadow-border)]"
          role="listbox"
        >
          {matches.map((row, i) => (
            <li key={`${row.name}-${i}`}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm ${
                  i === highlight ? "bg-muted" : "hover:bg-muted"
                }`}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(row)}
              >
                <span className="font-medium">{row.name}</span>
                {row.description ? (
                  <span className="line-clamp-1 text-xs text-muted-foreground">{row.description}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
