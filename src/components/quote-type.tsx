import { WORK_TYPES } from "@/lib/housefile/quote";
import { cn } from "@/lib/utils";

export function QuoteTypePicker({
  onPick,
  title = "What are you quoting?",
  hint = "The File is often a start. A painter may have opened it. A roof still needs its own takeoff.",
}: {
  onPick: (workId: string) => void;
  title?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {WORK_TYPES.map((w) => (
          <li key={w.id}>
            <button
              type="button"
              onClick={() => onPick(w.id)}
              className={cn(
                "min-h-11 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground",
                "hover:bg-primary/90",
              )}
            >
              {w.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
