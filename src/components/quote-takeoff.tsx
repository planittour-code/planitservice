import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  applyPriceBook,
  bookLabel,
  pickKey,
  proposedCostKey,
  slotsForWork,
  type PriceBookItem,
} from "@/lib/housefile/book";
import { money } from "@/lib/housefile/format";
import {
  buildQuote,
  fieldVisible,
  nInput,
  quoteTotal,
  suggestedSquares,
  type QuoteLine,
  type TakeoffField,
  type WorkType,
} from "@/lib/housefile/quote";
import type { ShopRole } from "@/lib/housefile/types";
import { cn } from "@/lib/utils";

export function TakeoffForm({
  work,
  inputs,
  onChange,
  book,
  role,
}: {
  work: WorkType;
  inputs: Record<string, string>;
  onChange: (key: string, value: string) => void;
  book: PriceBookItem[];
  role: ShopRole;
}) {
  const lines = applyPriceBook(buildQuote(work.id, inputs), book, inputs);
  const total = quoteTotal(lines);
  const squares = work.id === "roof" ? suggestedSquares(inputs) : 0;
  const slots = slotsForWork(work.id, inputs);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-5">
        <p className="text-muted-foreground">{work.blurb}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {work.fields.filter((field) => fieldVisible(field, inputs)).map((field) => (
            <TakeoffInput
              key={field.key}
              field={field}
              value={inputs[field.key] ?? ""}
              onChange={(v) => onChange(field.key, v)}
            />
          ))}
        </div>
        {work.id === "roof" && nInput(inputs, "roof_squares") <= 0 && squares > 0 && (
          <p className="text-sm text-muted-foreground">
            Estimated {squares} squares from footprint and pitch. Enter a measured count to lock it.
          </p>
        )}
        {slots.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Products from the price book</p>
            {slots.map((slot) => {
              const options = book.filter((b) => b.active !== false && b.slot === slot.id);
              const picked = inputs[pickKey(slot.id)] ?? options[0]?.id ?? "";
              const item = options.find((o) => o.id === picked);
              return (
                <div key={slot.id} className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor={`book-${slot.id}`}>{slot.label}</Label>
                  {options.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nothing in the book for this yet. The owner adds it under Price book.
                    </p>
                  ) : (
                    <select
                      id={`book-${slot.id}`}
                      value={picked}
                      onChange={(e) => onChange(pickKey(slot.id), e.target.value)}
                      className="flex h-11 w-full rounded-md bg-card px-3 text-sm shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {bookLabel(o)}
                          {o.cost == null ? " — no cost" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                  {item && item.cost != null && (
                    <p className="text-xs text-muted-foreground">
                      Cost {money(item.cost)} / {item.unit}
                      {item.sell != null ? ` · sell ${money(item.sell)}` : ""}
                    </p>
                  )}
                  {item && item.cost == null && (
                    <div className="space-y-1.5">
                      <Label htmlFor={`cost-${item.id}`}>Cost for this quote ({item.unit})</Label>
                      <Input
                        id={`cost-${item.id}`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        placeholder="What the yard will charge"
                        value={inputs[proposedCostKey(item.id)] ?? ""}
                        onChange={(e) => onChange(proposedCostKey(item.id), e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        {role === "owner"
                          ? "This writes into the book when you send."
                          : "The owner has to approve this number before the homeowner sees the quote."}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <QuotePreview lines={lines} total={total} showCost />
    </div>
  );
}

export function QuotePreview({
  lines,
  total,
  showCost = false,
}: {
  lines: QuoteLine[];
  total: number;
  showCost?: boolean;
}) {
  const costTotal = lines
    .filter((l) => l.included && l.qty > 0 && l.unit_cost != null)
    .reduce((s, l) => s + l.qty * (l.unit_cost ?? 0), 0);
  return (
    <aside className="order-first h-fit rounded-xl bg-card p-4 shadow-[var(--shadow-border)] lg:sticky lg:top-24 lg:order-none">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">This quote</p>
      <p className="font-display text-3xl font-medium tabular-nums">{money(total)}</p>
      {showCost && costTotal > 0 && (
        <p className="text-xs text-muted-foreground">Material cost {money(costTotal)}</p>
      )}
      <ul className="mt-3 space-y-2 text-sm">
        {lines.map((l) => (
          <li
            key={l.name}
            className={cn("flex justify-between gap-3", !l.included && "text-muted-foreground")}
          >
            <span>
              {l.name}
              {l.optional && !l.included ? " (off)" : ""}
              {l.needsCost ? " · needs cost" : ""}
            </span>
            <span className="tabular-nums">{l.included ? money(l.qty * l.unit_price) : "—"}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function TakeoffInput({
  field,
  value,
  onChange,
}: {
  field: TakeoffField;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = `to-${field.key}`;
  if (field.kind === "toggle") {
    const on = value === "yes" || value === "true" || value === "1";
    return (
      <label className="flex min-h-11 items-center gap-3 rounded-lg bg-card px-3 py-2 shadow-[var(--shadow-border)] sm:col-span-2">
        <input
          id={id}
          type="checkbox"
          checked={on}
          onChange={(e) => onChange(e.target.checked ? "yes" : "no")}
          className="size-4"
        />
        <span>
          <span className="block text-sm font-medium">{field.label}</span>
          <span className="block text-xs text-muted-foreground">{field.hint}</span>
        </span>
      </label>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {field.label}
        {field.unit ? ` (${field.unit})` : ""}
        {field.required ? " *" : ""}
      </Label>
      {field.kind === "select" ? (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex h-11 w-full rounded-md bg-card px-3 text-sm shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <Input
          id={id}
          type={field.kind === "number" ? "number" : "text"}
          inputMode={field.kind === "number" ? "decimal" : "text"}
          step={field.kind === "number" ? "any" : undefined}
          min={field.kind === "number" ? 0 : undefined}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <p className="text-xs text-muted-foreground">{field.hint}</p>
    </div>
  );
}
