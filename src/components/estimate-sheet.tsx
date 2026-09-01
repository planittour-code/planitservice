import { bookLabel, type PriceBookItem } from "@/lib/housefile/book";
import {
  applyBookToLine,
  blankEstimateLine,
  estimateTotal,
  lineAmount,
  type EstimateLine,
} from "@/lib/housefile/estimate-lines";
import { money } from "@/lib/housefile/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
                onChange={(e) => patch(row.id, { item: e.target.value, bookId: row.bookId && e.target.value !== row.item ? row.bookId : row.bookId })}
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
              <NumField
                label="Quantity"
                value={row.qty}
                onChange={(v) => patch(row.id, { qty: v })}
              />
              <NumField
                label="Cost"
                value={row.cost}
                onChange={(v) => patch(row.id, { cost: v })}
              />
              <NumField
                label="Price"
                value={row.price}
                onChange={(v) => patch(row.id, { price: v })}
              />
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <p className="flex h-11 items-center tabular-nums">{money(lineAmount(row))}</p>
              </div>
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
