import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkKit } from "@/lib/housefile/kits";
import { cn } from "@/lib/utils";

export function KitPicker({
  kits,
  selectedIds,
  onToggle,
  onSkip,
  skipped,
}: {
  kits: WorkKit[];
  selectedIds: string[];
  onToggle: (kit: WorkKit) => void;
  onSkip: () => void;
  skipped: boolean;
}) {
  const selected = new Set(selectedIds);
  const selectedNames = kits.filter((kit) => selected.has(kit.id)).map((kit) => kit.name);
  return (
    <div className="space-y-3">
      <div>
        <p className="font-display text-xl font-medium">Pre-Saved Templates</p>
        <p className="text-sm text-muted-foreground">
          Select one or more for this category. The job starts with those subcategories combined.
          Every line stays editable.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {kits.map((kit) => {
          const on = selected.has(kit.id);
          return (
            <li key={kit.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(kit)}
                className={cn(
                  "flex min-h-20 w-full items-start gap-3 rounded-xl p-4 text-left shadow-[var(--shadow-border)]",
                  "transition-[box-shadow,opacity] duration-150 hover:opacity-95",
                  on ? "bg-primary text-primary-foreground" : "bg-card",
                )}
              >
                <span
                  className={cn(
                    "mt-1 flex size-5 shrink-0 items-center justify-center rounded-sm border",
                    on
                      ? "border-primary-foreground bg-primary-foreground text-primary"
                      : "border-border bg-background",
                  )}
                  aria-hidden
                >
                  {on ? <Check className="size-3.5" strokeWidth={2.5} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <p className="font-display text-lg font-medium">{kit.name}</p>
                  <p className={cn("text-sm", on ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {kit.items.length} {kit.items.length === 1 ? "line item" : "line items"}
                  </p>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {selectedNames.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {selectedNames.length === 1
            ? `Selected: ${selectedNames[0]}`
            : `Selected: ${selectedNames.join(", ")}`}
        </p>
      ) : null}
      <Button type="button" variant={skipped ? "secondary" : "outline"} onClick={onSkip}>
        {skipped ? "Using a blank starter" : "Start without a kit"}
      </Button>
    </div>
  );
}
