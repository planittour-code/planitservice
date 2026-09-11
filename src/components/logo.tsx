import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <ellipse
        cx="16"
        cy="16"
        rx="12.2"
        ry="4.5"
        fill="none"
        stroke="#f3eee4"
        strokeWidth="1.45"
        opacity="0.42"
        transform="rotate(-28 16 16)"
      />
      <circle cx="16" cy="16" r="7.15" fill="#f3eee4" />
      <path
        fill="currentColor"
        d="M12.1 12.05c1.55-1.05 3.05-.15 2.95 1.45-.12 1.7-1.55 2.2-1.45 3.55.08.95-.7 1.7-1.6 1.45-.95-.25-1.15-1.45-.7-2.25.5-1 .15-2.15-.25-3.05-.35-.75.3-1.15 1.05-1.15Z"
      />
      <path
        fill="currentColor"
        d="M17.15 11.35c1.85-.55 3.35.75 3.05 2.2-.4 1.55-2.05 1.9-1.85 3.3.18 1.15-1.05 2.15-2.15 1.7-1.05-.4-.75-1.55-.15-2.15.7-.7.35-1.55.15-2.35-.2-.8.25-2.25.95-2.7Z"
      />
      <path
        fill="none"
        stroke="#f3eee4"
        strokeWidth="1.45"
        strokeLinecap="round"
        d="M5.55 17.85c2.35 3.35 6.85 5.05 11.05 4.05 4.15-1 7.35-4.05 8.65-7.7"
      />
      <circle cx="25.35" cy="12.05" r="1.55" fill="#f3eee4" />
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
