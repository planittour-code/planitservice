import { Folder } from "lucide-react";
import type { ReactNode } from "react";

export function MonthFolder({
  label,
  count,
  countLabel,
  children,
}: {
  label: string;
  count: number;
  countLabel?: string;
  children: ReactNode;
}) {
  return (
    <details className="group/folder">
      <summary className="relative cursor-pointer list-none pt-6 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="absolute top-0 left-3 h-6 w-36 rounded-t-md bg-chip-gutters shadow-[var(--shadow-border)]"
        />
        <span className="relative flex min-h-12 items-center justify-between gap-3 rounded-xl bg-chip-gutters px-4 py-3 text-foreground shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 group-open/folder:rounded-b-none group-open/folder:shadow-[var(--shadow-border-hover)]">
          <span className="flex min-w-0 items-center gap-2">
            <Folder className="size-5 shrink-0" aria-hidden />
            <span className="min-w-0 truncate font-display text-lg font-medium">{label}</span>
          </span>
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
            {countLabel ?? `${count} ${count === 1 ? "record" : "records"}`}
          </span>
        </span>
      </summary>
      <div className="rounded-b-xl bg-paper px-1.5 pt-2 pb-1.5 shadow-[var(--shadow-border)]">
        {children}
      </div>
    </details>
  );
}
