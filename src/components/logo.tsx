import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const LOGO_SRC = "/PS-logo.png";

export function Mark({ className }: { className?: string }) {
  return (
    <img
      src={LOGO_SRC}
      alt=""
      className={cn("size-8 shrink-0 rounded-sm object-cover outline-none", className)}
      aria-hidden
    />
  );
}

export function Wordmark({ className, to = "/" }: { className?: string; to?: string }) {
  return (
    <Link to={to} className={cn("flex items-center gap-2", className)}>
      <Mark className="size-20" />
      <span className="font-display text-xl font-extrabold uppercase tracking-wide text-inherit">
        PlanitService
      </span>
    </Link>
  );
}
