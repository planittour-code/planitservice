import { TradeGrid } from "@/components/trade-face";
import { WORK_TYPES, type WorkType } from "@/lib/housefile/quote";

export function QuoteTypePicker({
  onPick,
  title = "What are you quoting?",
  hint = "The Property Record is often a start. A painter may have opened it. A roof still needs its own takeoff.",
  types = WORK_TYPES,
}: {
  onPick: (workId: string) => void;
  title?: string;
  hint?: string;
  types?: WorkType[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <TradeGrid types={types} onPick={onPick} compact />
    </div>
  );
}
