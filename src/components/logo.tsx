import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const LOGO_SRC = "/PS-logo.png";

export function Mark({ className }: { className?: string }) {
  return (
    <img
      src={LOGO_SRC}
      alt=""
      className={cn("size-8 shrink-0 rounded-md object-cover outline-none", className)}
      aria-hidden
    />
  );
}

export function Wordmark({
  className,
  to = "/",
  plate = false,
}: {
  className?: string;
  to?: string;
  /** White chip so the dark mark stays readable on the navy header. */
  plate?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2.5",
        plate && "rounded-md bg-white px-2 py-1 text-[#0b3a6a] shadow-[var(--shadow-border)]",
        className,
      )}
    >
      <Mark className={cn("size-10", plate && "bg-white")} />
      <span className="font-display text-lg font-semibold tracking-tight text-inherit">
        PlanitService
      </span>
    </Link>
  );
}
