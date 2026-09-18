import {
  ArrowRightLeft,
  Briefcase,
  CalendarCheck,
  Camera,
  ClipboardList,
  House,
  Ruler,
  Shield,
  Store,
} from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "photos", label: "Photos", Icon: Camera },
  { id: "house-data", label: "House data", Icon: House },
  { id: "jobs", label: "Jobs", Icon: Briefcase },
  { id: "shops", label: "Known shops", Icon: Store },
  { id: "warranties", label: "Warranties", Icon: Shield },
  { id: "maintenance", label: "Maintenance", Icon: CalendarCheck },
  { id: "transfer", label: "Transfer", Icon: ArrowRightLeft },
  { id: "measure", label: "Measurements", Icon: Ruler },
  { id: "request-estimates", label: "Request Estimates", Icon: ClipboardList },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function jumpTo(id: SectionId) {
  const root = document.getElementById(id);
  if (!root) return;
  const details = root.matches("details")
    ? root
    : root.querySelector("details");
  if (details instanceof HTMLDetailsElement) details.open = true;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

export function HomeownerSectionNav() {
  const [active, setActive] = useState<SectionId>("photos");

  useEffect(() => {
    const nodes = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => Boolean(el),
    );
    if (!nodes.length) return;
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting);
        const visible = SECTIONS.find((s) => seen.get(s.id));
        if (visible) setActive(visible.id);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.2, 0.6] },
    );
    for (const node of nodes) io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <nav
      aria-label="On this Property Record"
      className="pointer-events-none fixed top-1/2 right-2 z-40 -translate-y-1/2 sm:right-3"
    >
      <ul className="pointer-events-auto flex flex-col gap-0.5 rounded-xl bg-background/40 p-1 shadow-[var(--shadow-border)] backdrop-blur-md">
        {SECTIONS.map((section) => (
          <li key={section.id}>
            <SectionLink
              label={section.label}
              Icon={section.Icon}
              active={active === section.id}
              onClick={() => jumpTo(section.id)}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SectionLink({
  label,
  Icon,
  active,
  onClick,
}: {
  label: string;
  Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-current={active ? "location" : undefined}
      onClick={onClick}
      className={cn(
        "group relative grid size-11 place-items-center rounded-lg text-secondary/70 transition-[background-color,color,transform] duration-150 ease-out hover:bg-background/70 hover:text-secondary active:scale-[0.96]",
        active && "bg-background/80 text-primary",
      )}
    >
      <Icon className="size-5" aria-hidden />
      <span className="pointer-events-none absolute top-1/2 right-full mr-2 hidden -translate-y-1/2 rounded-md bg-secondary px-2 py-1 text-xs font-semibold whitespace-nowrap text-secondary-foreground opacity-0 shadow-[var(--shadow-border)] transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 sm:block">
        {label}
      </span>
    </button>
  );
}
