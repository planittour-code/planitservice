import { Link } from "@tanstack/react-router";
import {
  AppWindow,
  Columns2,
  Droplets,
  Fence,
  House,
  Layers,
  PaintRoller,
  type LucideIcon,
} from "lucide-react";
import type { WorkType } from "@/lib/housefile/quote";
import { cn } from "@/lib/utils";

export const TRADE_FACE: Record<string, { icon: LucideIcon; surface: string }> = {
  paint: { icon: PaintRoller, surface: "bg-trade-paint text-primary-foreground" },
  roof: { icon: House, surface: "bg-trade-roof text-primary-foreground" },
  windows: { icon: AppWindow, surface: "bg-trade-windows text-primary-foreground" },
  gutters: { icon: Droplets, surface: "bg-trade-gutters text-primary-foreground" },
  siding: { icon: Layers, surface: "bg-trade-siding text-primary-foreground" },
  deck: { icon: Fence, surface: "bg-trade-deck text-primary-foreground" },
  porch: { icon: Columns2, surface: "bg-trade-porch text-primary-foreground" },
};

export function TradeTile({
  work,
  onPick,
  compact = false,
}: {
  work: WorkType;
  onPick?: (workId: string) => void;
  compact?: boolean;
}) {
  const face = TRADE_FACE[work.id] ?? TRADE_FACE.paint;
  const Icon = face.icon;
  const className = cn(
    "flex w-full flex-col items-start text-left shadow-[var(--shadow-border)]",
    "transition-[box-shadow,opacity] duration-150 hover:opacity-95 hover:shadow-[var(--shadow-border-hover)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
    face.surface,
    compact ? "min-h-20 rounded-lg p-3" : "min-h-28 rounded-xl p-4",
  );
  const inner = (
    <>
      <Icon className={compact ? "size-5" : "size-7"} aria-hidden />
      <p className={cn("font-display font-medium leading-tight", compact ? "mt-2 text-base" : "mt-3 text-lg")}>
        {work.name}
      </p>
      {!compact && <p className="mt-1 text-sm text-primary-foreground/80">{work.blurb}</p>}
    </>
  );
  if (onPick) {
    return (
      <button type="button" onClick={() => onPick(work.id)} className={className}>
        {inner}
      </button>
    );
  }
  return (
    <Link to="/app/new" search={{ work: work.id }} className={className}>
      {inner}
    </Link>
  );
}

export function TradeGrid({
  types,
  onPick,
  compact = false,
}: {
  types: WorkType[];
  onPick?: (workId: string) => void;
  compact?: boolean;
}) {
  return (
    <ul className={cn("grid gap-3", compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4")}>
      {types.map((work) => (
        <li key={work.id}>
          <TradeTile work={work} onPick={onPick} compact={compact} />
        </li>
      ))}
    </ul>
  );
}
