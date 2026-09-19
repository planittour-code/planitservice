import {
  ArrowRightLeft,
  Briefcase,
  CalendarCheck,
  Camera,
  CheckCircle2,
  ClipboardList,
  FileText,
  House,
  Mail,
  Ruler,
  Shield,
  Store,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type FileSection = {
  id: string;
  label: string;
  Icon: LucideIcon;
};

export const HOMEOWNER_SECTIONS: FileSection[] = [
  { id: "photos", label: "Photos", Icon: Camera },
  { id: "house-data", label: "House data", Icon: House },
  { id: "jobs", label: "Jobs", Icon: Briefcase },
  { id: "shops", label: "Known shops", Icon: Store },
  { id: "warranties", label: "Warranties", Icon: Shield },
  { id: "maintenance", label: "Maintenance", Icon: CalendarCheck },
  { id: "transfer", label: "Transfer", Icon: ArrowRightLeft },
  { id: "measure", label: "Measurements", Icon: Ruler },
  { id: "request-estimates", label: "Request Estimates", Icon: ClipboardList },
];

export const MANAGER_SECTIONS: FileSection[] = [
  { id: "invite-owner", label: "Invite the owner", Icon: Mail },
  { id: "photos", label: "Photos", Icon: Camera },
  { id: "house-data", label: "House data", Icon: House },
  { id: "jobs", label: "Jobs", Icon: Briefcase },
  { id: "shops", label: "Known shops", Icon: Store },
  { id: "warranties", label: "Warranties", Icon: Shield },
  { id: "request-estimates", label: "Request Estimates", Icon: ClipboardList },
  { id: "agreed-work", label: "Agreed work", Icon: CheckCircle2 },
  { id: "maintenance", label: "Maintenance", Icon: CalendarCheck },
];

export const CONTRACTOR_SECTIONS: FileSection[] = [
  { id: "quotes", label: "Quotes", Icon: FileText },
  { id: "photos", label: "Photos", Icon: Camera },
  { id: "jobs", label: "Jobs", Icon: Briefcase },
  { id: "warranties", label: "Warranties", Icon: Shield },
  { id: "house-data", label: "House data", Icon: House },
];

function jumpTo(id: string) {
  const root = document.getElementById(id);
  if (!root) return;
  const details = root.matches("details") ? root : root.querySelector("details");
  if (details instanceof HTMLDetailsElement) details.open = true;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

export function FileSectionNav({ sections }: { sections: FileSection[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  const ids = sections.map((s) => s.id).join("|");
  useEffect(() => {
    const list = ids.split("|").filter(Boolean);
    const present = list.filter((id) => document.getElementById(id));
    if (!present.length) return;
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting);
        const visible = present.find((id) => seen.get(id));
        if (visible) setActive(visible);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.2, 0.6] },
    );
    for (const id of present) {
      const node = document.getElementById(id);
      if (node) io.observe(node);
    }
    return () => io.disconnect();
  }, [ids]);

  return (
    <nav
      aria-label="On this Property Record"
      className="pointer-events-none fixed top-1/2 right-2 z-40 -translate-y-1/2 sm:right-3"
    >
      <ul className="pointer-events-auto flex flex-col gap-0.5 rounded-xl bg-background/40 p-1 shadow-[var(--shadow-border)] backdrop-blur-md">
        {sections.map((section) => (
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
  Icon: LucideIcon;
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
