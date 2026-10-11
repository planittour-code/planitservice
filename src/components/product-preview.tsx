import { useState } from "react";
import { Store } from "lucide-react";
import { cn } from "@/lib/utils";

const SAMPLE = {
  kicker: "Sample Property Record",
  title: "142 Maple Street",
  place: "Marietta, GA · labeled sample",
} as const;

const JOBS = [
  {
    id: "roof",
    label: "Architectural shingle reroof",
    year: "2019",
    photo: "/houses/maple-roof.jpg",
    photoAlt: "Architectural shingle roof on the sample house",
    product: "Architectural shingles",
    color: "Charcoal",
    warranty: "25-year material",
    shop: "Northside Roofing",
    note: "Pitch and color stay on the file for the next roof visit.",
    chip: "bg-chip-roof",
  },
  {
    id: "paint",
    label: "Exterior paint",
    year: "2023",
    photo: "/houses/maple-siding.jpg",
    photoAlt: "Painted siding on the sample house",
    product: "SW 7008 Alabaster",
    color: "Alabaster",
    warranty: "7-year labor",
    shop: "Painting Plus",
    note: "Body Alabaster. Trim Extra White. The next coat starts from this chip.",
    chip: "bg-chip-paint",
  },
  {
    id: "gutters",
    label: "Roll Lock Gutter Guards",
    year: "Lifetime",
    photo: "/houses/maple-gutters.jpg",
    photoAlt: "Gutter guards on the sample house",
    product: "Roll Lock Gutter Guards",
    color: "Heritage Cream",
    warranty: "Lifetime",
    shop: "Gutters Plus",
    note: "6-inch K-style. Guards and color are already on the record.",
    chip: "bg-chip-gutters",
  },
] as const;

type JobId = (typeof JOBS)[number]["id"];

export function ProductPreview({
  kicker = SAMPLE.kicker,
  title = SAMPLE.title,
  place = SAMPLE.place,
}: {
  kicker?: string;
  title?: string;
  place?: string;
}) {
  const [jobId, setJobId] = useState<JobId>("roof");
  const job = JOBS.find((item) => item.id === jobId) ?? JOBS[0];

  return (
    <aside className="overflow-hidden rounded-xl bg-card text-foreground shadow-[var(--shadow-border)]">
      <div className="flex flex-col gap-1 bg-secondary px-4 py-2.5 text-secondary-foreground sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-secondary-foreground/70">{kicker}</p>
          <p className="truncate font-display text-base font-semibold tracking-tight">{title}</p>
        </div>
        <p className="text-xs text-secondary-foreground/70">{place}</p>
      </div>

      <img src={job.photo} alt={job.photoAlt} className="aspect-[16/9] w-full object-cover" />

      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground">Jobs on file</p>
          <p className="text-sm text-muted-foreground">Tap a line. The photo, product, and shop follow.</p>
        </div>

        <ul className="overflow-hidden rounded-lg bg-muted/60 shadow-[var(--shadow-border)]">
          {JOBS.map((item) => {
            const selected = item.id === job.id;
            return (
              <li key={item.id} className="border-t border-border first:border-t-0">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setJobId(item.id)}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-3 border-l-4 px-3 py-2.5 text-left text-sm transition-colors duration-150 ease-[var(--ease-smooth-out)]",
                    selected
                      ? "border-l-secondary bg-card text-foreground"
                      : "border-l-transparent bg-transparent text-muted-foreground hover:bg-card/80 hover:text-foreground",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        "size-4 shrink-0 rounded-[2px] outline outline-1 -outline-offset-1 outline-foreground/25",
                        item.chip,
                      )}
                      aria-hidden
                    />
                    <span className={cn("truncate", selected && "font-medium text-foreground")}>
                      {item.label}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{item.year}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="rounded-lg bg-muted/40 p-3 shadow-[var(--shadow-border)]">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Store className="size-3.5 text-secondary" aria-hidden />
            {job.shop}
            <span className="font-normal text-muted-foreground">· known shop</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {job.product} · {job.color} · {job.warranty}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{job.note}</p>
        </div>
      </div>
    </aside>
  );
}
