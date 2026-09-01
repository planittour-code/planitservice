import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EstimateSheet } from "@/components/estimate-sheet";
import {
  applyPriceBook,
  type PriceBookItem,
} from "@/lib/housefile/book";
import {
  ESTIMATE_KEY,
  blankEstimateLine,
  parseEstimateLines,
  serializeEstimateLines,
} from "@/lib/housefile/estimate-lines";
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
}: {
  work: WorkType;
  inputs: Record<string, string>;
  onChange: (key: string, value: string) => void;
  book: PriceBookItem[];
  role: ShopRole;
}) {
  const generated = applyPriceBook(buildQuote(work.id, inputs), book, inputs);
  const total = quoteTotal(generated);
  const squares = work.id === "roof" ? suggestedSquares(inputs) : 0;
  const estimate = parseEstimateLines(inputs[ESTIMATE_KEY]);
  const rows = estimate.length > 0 ? estimate : [blankEstimateLine()];

  return (
    <div className="space-y-8">
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
      </div>
      <EstimateSheet
        book={book}
        lines={rows}
        onChange={(next) => onChange(ESTIMATE_KEY, serializeEstimateLines(next))}
      />
      {generated.length > 0 && estimate.length === 0 && (
        <QuotePreview lines={generated} total={total} showCost />
      )}
    </div>
  );
}

export function QuotePreview({
  lines,
  total,
  showCost = false,
  sticky = false,
}: {
  lines: QuoteLine[];
  total: number;
  showCost?: boolean;
  sticky?: boolean;
}) {
  const costTotal = lines
    .filter((l) => l.included && l.qty > 0 && l.unit_cost != null)
    .reduce((s, l) => s + l.qty * (l.unit_cost ?? 0), 0);
  return (
    <aside
      className={cn(
        "relative z-0 h-fit rounded-xl bg-card p-4 shadow-[var(--shadow-border)]",
        sticky && "order-first lg:sticky lg:top-24 lg:z-10 lg:order-none",
      )}
    >
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
