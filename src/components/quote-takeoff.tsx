import { EstimateSheet } from "@/components/estimate-sheet";
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
import type { QuoteLine } from "@/lib/housefile/quote";
import { cn } from "@/lib/utils";

export function TakeoffForm({
  workId,
  workName,
  blurb,
  paintScope,
  inputs,
  onChange,
  book,
}: {
  workId: string;
  workName: string;
  blurb: string;
  paintScope?: string;
  inputs: Record<string, string>;
  onChange: (key: string, value: string) => void;
  book: PriceBookItem[];
}) {
  const estimate = parseEstimateLines(inputs[ESTIMATE_KEY]);
  const rows = estimate.length > 0 ? estimate : seedEstimateLines(workId, book, paintScope);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">{workName}</h1>
        <p className="text-muted-foreground">{blurb}</p>
      </div>
      {workId === "paint" && (
        <div className="space-y-1.5 max-w-xs">
          <Label htmlFor="paint-scope">Where</Label>
          <select
            id="paint-scope"
            value={paintScope === "exterior" ? "exterior" : "interior"}
            onChange={(e) => {
              const scope = e.target.value;
              onChange("paint_scope", scope);
              onChange(ESTIMATE_KEY, serializeEstimateLines(seedEstimateLines(workId, book, scope)));
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
      />
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
