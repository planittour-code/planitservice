import { bookLabel, type PriceBookItem } from "@/lib/housefile/book";
import {
  applyBookToLine,
  blankEstimateLine,
  estimateTotal,
  lineAmount,
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
}: {
  book: PriceBookItem[];
  lines: EstimateLine[];
  onChange: (next: EstimateLine[]) => void;
}) {
  const items = book.filter((b) => b.active !== false);
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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-medium tracking-tight">Line items</h2>
        <p className="text-sm text-muted-foreground">
          Pick from the price book or type a custom item. Amount is quantity × price.
        </p>
      </div>
      <div className="space-y-4">
        {lines.map((row, index) => (
          <div key={row.id} className="space-y-3 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Line {index + 1}</p>
              {lines.length > 1 && (
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => onChange(lines.filter((l) => l.id !== row.id))}
                >
                  Remove
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`item-${row.id}`}>Item</Label>
              <select
                id={`item-${row.id}`}
                value={row.bookId}
                onChange={(e) => pickItem(row.id, e.target.value)}
                className="flex h-11 w-full rounded-md bg-background px-3 text-sm shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option value="">Custom item</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {bookLabel(item)}
                    {item.cost == null ? " — no cost" : ""}
                  </option>
                ))}
              </select>
              <Input
                value={row.item}
                onChange={(e) => patch(row.id, { item: e.target.value })}
                placeholder="Item name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`desc-${row.id}`}>Description</Label>
              <Textarea
                id={`desc-${row.id}`}
                rows={4}
                value={row.description}
                onChange={(e) => patch(row.id, { description: e.target.value })}
                placeholder="Scope, prep, product, notes the homeowner should see"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumField label="Quantity" value={row.qty} onChange={(v) => patch(row.id, { qty: v })} />
              <NumField label="Cost" value={row.cost} onChange={(v) => patch(row.id, { cost: v })} />
              <NumField label="Price" value={row.price} onChange={(v) => patch(row.id, { price: v })} />
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <p className="flex h-11 items-center tabular-nums">{money(lineAmount(row))}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Photos</Label>
                <label className="inline-flex min-h-9 cursor-pointer items-center rounded-md bg-background px-3 text-sm shadow-[var(--shadow-border)]">
                  Add photos
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      void addPhotos(row.id, e.target.files);
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
                        onClick={() =>
                          patch(row.id, { photos: row.photos.filter((_, idx) => idx !== i) })
                        }
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
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => onChange([...lines, blankEstimateLine()])}>
          Add a line
        </Button>
        <p className="font-display text-2xl font-medium tabular-nums">
          Total Amount {money(total)}
        </p>
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
