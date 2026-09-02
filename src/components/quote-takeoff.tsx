import { useState } from "react";
import { EstimateSheet } from "@/components/estimate-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PriceBookItem } from "@/lib/housefile/book";
import {
  ESTIMATE_KEY,
  blankEstimateLine,
  parseEstimateLines,
  seedEstimateLines,
  serializeEstimateLines,
} from "@/lib/housefile/estimate-lines";
import { money } from "@/lib/housefile/format";
import {
  fieldVisible,
  type QuoteLine,
  type TakeoffField,
  type WorkType,
} from "@/lib/housefile/quote";
import { cn } from "@/lib/utils";

export function TakeoffForm({
  work,
  paintScope,
  inputs,
  onChange,
  book,
}: {
  work: WorkType;
  paintScope?: string;
  inputs: Record<string, string>;
  onChange: (key: string, value: string) => void;
  book: PriceBookItem[];
}) {
  const [showMeasures, setShowMeasures] = useState(false);
  const estimate = parseEstimateLines(inputs[ESTIMATE_KEY]);
  const rows = estimate.length > 0 ? estimate : seedEstimateLines(work.id, book, paintScope);
  const measureFields = work.fields.filter(
    (field) => field.key !== "paint_scope" && fieldVisible(field, inputs),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">{work.name}</h1>
        <p className="text-muted-foreground">{work.blurb}</p>
      </div>
      {work.id === "paint" && (
        <div className="space-y-1.5 max-w-xs">
          <Label htmlFor="paint-scope">Where</Label>
          <select
            id="paint-scope"
            value={paintScope === "exterior" ? "exterior" : "interior"}
            onChange={(e) => {
              const scope = e.target.value;
              onChange("paint_scope", scope);
              onChange(ESTIMATE_KEY, serializeEstimateLines(seedEstimateLines(work.id, book, scope)));
            }}
            className="flex h-11 w-full rounded-md bg-card px-3 text-sm shadow-[var(--shadow-border)] outline-none"
          >
            <option value="interior">Interior</option>
            <option value="exterior">Exterior</option>
          </select>
        </div>
      )}
      <EstimateSheet
        book={book}
        lines={rows.length ? rows : [blankEstimateLine()]}
        onChange={(next) => onChange(ESTIMATE_KEY, serializeEstimateLines(next))}
        workId={work.id}
        paintScope={paintScope}
      />
      {measureFields.length > 0 && (
        <div className="space-y-3">
          <Button type="button" variant="outline" onClick={() => setShowMeasures((v) => !v)}>
            {showMeasures ? "Hide measurements" : "Add measurements"}
          </Button>
          {showMeasures && (
            <div className="grid gap-3 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:grid-cols-2">
              <p className="text-sm text-muted-foreground sm:col-span-2">
                Optional. These write onto the property record. They do not price the lines.
              </p>
              {measureFields.map((field) => (
                <TakeoffInput
                  key={field.key}
                  field={field}
                  value={inputs[field.key] ?? ""}
                  onChange={(v) => onChange(field.key, v)}
                />
              ))}
            </div>
          )}
        </div>
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
            <span>{l.name}</span>
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
      <label className="flex min-h-11 items-center gap-3 rounded-lg bg-background px-3 py-2 shadow-[var(--shadow-border)] sm:col-span-2">
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
      </Label>
      {field.kind === "select" ? (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex h-11 w-full rounded-md bg-background px-3 text-sm shadow-[var(--shadow-border)] outline-none"
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
    </div>
  );
}
