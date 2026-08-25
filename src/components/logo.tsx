import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path fill="#f3eee4" d="M7 14.2 16 7.4 25 14.2V24H7V14.2Z" />
      <path fill="currentColor" d="M13.2 24v-7.2h5.6V24H13.2Z" />
      <path fill="#f3eee4" d="M20 6.2h5.2v3.4H22.4V9H20V6.2Z" />
    </svg>
  );
}

export function Wordmark({ className, to = "/" }: { className?: string; to?: string }) {
  return (
    <Link to={to} className={cn("flex items-center gap-2.5 text-primary", className)}>
      <Mark />
      <span className="font-display text-lg font-medium tracking-tight text-foreground">
        PlanitService
      </span>
    </Link>
  );
}
