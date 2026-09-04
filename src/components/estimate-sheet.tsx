import { bookLabel, type PriceBookItem } from "@/lib/housefile/book";
import {
  applyBookToLine,
  blankEstimateLine,
  estimateTotal,
  lineAmount,
  linesForOption,
  optionsFor,
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
  lines,
  onChange,
  workId,
  paintScope,
}: {
  book: PriceBookItem[];
  lines: EstimateLine[];
  onChange: (next: EstimateLine[]) => void;
  workId?: string;
  paintScope?: string;
}) {
  const items = book.filter((b) => b.active !== false);
  const extras = workId ? optionsFor(workId, paintScope) : [];
  const core = lines.filter((l) => !l.optionId);
  const total = estimateTotal(lines);

  function patch(id: string, next: Partial<EstimateLine>) {
    onChange(lines.map((row) => (row.id === id ? { ...row, ...next } : row)));
  }

  function pickItem(id: string, bookId: string) {
    const row = lines.find((l) => l.id === id);
    if (!row) return;
    if (!bookId) {
      onChange(lines.map((l) => (l.id === id ? { ...l, bookId: "" } : l)));
      return;
    }
    onChange(lines.map((l) => (l.id === id ? applyBookToLine(l, items.find((b) => b.id === bookId)) : l)));
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

  function toggleOption(optionId: string, on: boolean) {
    const option = extras.find((o) => o.id === optionId);
    if (!option) return;
    if (!on) {
      onChange(lines.filter((l) => l.optionId !== optionId));
      return;
    }
    if (lines.some((l) => l.optionId === optionId)) return;
    onChange([...lines, ...linesForOption(option, items)]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-medium tracking-tight">Line items</h2>
        <p className="text-sm text-muted-foreground">
          Pick from materials or type a custom item. Amount is quantity × price.
        </p>
      </div>
      <div className="space-y-4">
        {core.map((row, index) => (
          <LineCard
            key={row.id}
            row={row}
            index={index}
            items={items}
            canRemove={core.length > 1}
            onPatch={(next) => patch(row.id, next)}
            onPick={(bookId) => pickItem(row.id, bookId)}
            onPhotos={(files) => void addPhotos(row.id, files)}
            onRemove={() => onChange(lines.filter((l) => l.id !== row.id))}
          />
        ))}
      </div>
      {extras.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="font-display text-xl font-medium">Optional work</h3>
            <p className="text-sm text-muted-foreground">
              Check an extra to open its lines. Uncheck to drop them from the quote.
            </p>
          </div>
          <div className="space-y-3">
            {extras.map((option) => {
              const on = lines.some((l) => l.optionId === option.id);
              const optionLines = lines.filter((l) => l.optionId === option.id);
              return (
                <div key={option.id} className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 size-4"
                      checked={on}
                      onChange={(e) => toggleOption(option.id, e.target.checked)}
                    />
                    <span>
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="block text-xs text-muted-foreground">{option.hint}</span>
                    </span>
                  </label>
                  {on && (
                    <div className="mt-4 space-y-3 border-l-2 border-border pl-4">
                      {optionLines.map((row, index) => (
                        <LineCard
                          key={row.id}
                          row={row}
                          index={index}
                          items={items}
                          canRemove={optionLines.length > 1}
                          onPatch={(next) => patch(row.id, next)}
                          onPick={(bookId) => pickItem(row.id, bookId)}
                          onPhotos={(files) => void addPhotos(row.id, files)}
                          onRemove={() => onChange(lines.filter((l) => l.id !== row.id))}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background/95 p-3 shadow-[var(--shadow-border)] sticky bottom-0 z-20 -mx-4 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <Button type="button" variant="outline" className="min-h-11" onClick={() => onChange([...lines, blankEstimateLine()])}>
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
  index,
  items,
  canRemove,
  onPatch,
  onPick,
  onPhotos,
  onRemove,
}: {
  row: EstimateLine;
  index: number;
  items: PriceBookItem[];
  canRemove: boolean;
  onPatch: (next: Partial<EstimateLine>) => void;
  onPick: (bookId: string) => void;
  onPhotos: (files: FileList | null) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl bg-background p-3 shadow-[var(--shadow-border)] sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Line {index + 1}</p>
        {canRemove && (
          <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`item-${row.id}`}>Item</Label>
        <select
          id={`item-${row.id}`}
          value={row.bookId}
          onChange={(e) => onPick(e.target.value)}
          className="flex h-11 w-full rounded-md bg-card px-3 text-sm shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <option value="">Custom item</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {bookLabel(item)}
              {item.cost == null ? " — no cost" : ""}
            </option>
          ))}
        </select>
        <Input value={row.item} onChange={(e) => onPatch({ item: e.target.value })} placeholder="Item name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`desc-${row.id}`}>Description</Label>
        <Textarea
          id={`desc-${row.id}`}
          rows={3}
          value={row.description}
          onChange={(e) => onPatch({ description: e.target.value })}
          placeholder="Scope, prep, product, notes the homeowner should see"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumField label="Quantity" value={row.qty} onChange={(v) => onPatch({ qty: v })} />
        <NumField label="Cost" value={row.cost} onChange={(v) => onPatch({ cost: v })} />
        <NumField label="Price" value={row.price} onChange={(v) => onPatch({ price: v })} />
        <div className="space-y-1.5">
          <Label>Amount</Label>
          <p className="flex h-11 items-center tabular-nums">{money(lineAmount(row))}</p>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label>Photos</Label>
          <label className="inline-flex min-h-9 cursor-pointer items-center rounded-md bg-card px-3 text-sm shadow-[var(--shadow-border)]">
            Add photos
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                onPhotos(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {(row.photos ?? []).length > 0 ? (
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
        ) : (
          <p className="text-xs text-muted-foreground">No photos on this line yet.</p>
        )}
      </div>
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
    <div className="space-y-1.5">
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
