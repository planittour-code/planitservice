import { useState } from "react";
import { FilePenLine, House, Store } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    id: "address",
    n: "01",
    title: "The address is the file.",
    body: "Search the house. Start a Property Record if one is not there. Photos, jobs, products, and warranties hang on that address.",
    Icon: House,
    panelKicker: "Property Record",
    panelTitle: "142 Maple Street",
    panelMeta: "Marietta, GA 30067",
    photo: "/houses/maple-front.jpg",
    photoAlt: "Craftsman bungalow used as the sample Property Record",
    rows: [
      { label: "Status", value: "File open" },
      { label: "Photos", value: "6 on file" },
      { label: "Jobs", value: "Roof · paint · guards" },
    ],
  },
  {
    id: "quote",
    n: "02",
    title: "The quote writes history.",
    body: "A shop measures, prices, and sends. Accepted work, products, and warranties stay on the record after the crew leaves.",
    Icon: FilePenLine,
    panelKicker: "Estimate on file",
    panelTitle: "Roll Lock Gutter Guards",
    panelMeta: "Gutters Plus · accepted",
    photo: "/houses/maple-gutters.jpg",
    photoAlt: "Gutter guards quoted onto the sample Property Record",
    rows: [
      { label: "Product", value: "6-inch K-style + Roll Lock" },
      { label: "Color", value: "Heritage Cream" },
      { label: "Written", value: "Job + warranty on file" },
    ],
  },
  {
    id: "callback",
    n: "03",
    title: "The known shop gets called back.",
    body: "Known providers stay on the file. Request Estimates is for new work, or when you want numbers from shops that already service the street.",
    Icon: Store,
    panelKicker: "Known shop",
    panelTitle: "Gutters Plus",
    panelMeta: "Last on this address · 2024",
    photo: "/houses/maple-siding.jpg",
    photoAlt: "House the known shop already painted",
    rows: [
      { label: "Trade", value: "Gutters · guards" },
      { label: "On file", value: "Product, color, warranty" },
      { label: "Next visit", value: "Call this shop first" },
    ],
  },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export function HowItWorks() {
  const [stepId, setStepId] = useState<StepId>("address");
  const step = STEPS.find((item) => item.id === stepId) ?? STEPS[0];

  return (
    <section id="how" className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-5">
        <p className="text-sm font-medium tracking-wide text-secondary">How the file works</p>
        <h2 className="mt-2 max-w-xl font-display text-3xl font-semibold tracking-tight">
          Address in. History out. The shop that wrote it gets the next call.
        </h2>

        <div className="mt-8 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:items-stretch">
          <ol className="flex flex-col gap-2">
            {STEPS.map((item) => {
              const selected = item.id === step.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setStepId(item.id)}
                    className={cn(
                      "flex w-full gap-4 rounded-xl p-4 text-left shadow-[var(--shadow-border)] transition-[background-color,box-shadow,color] duration-150 ease-[var(--ease-smooth-out)] sm:p-5",
                      selected
                        ? "bg-secondary text-secondary-foreground shadow-[var(--shadow-border-hover)]"
                        : "bg-card text-foreground hover:shadow-[var(--shadow-border-hover)]",
                    )}
                  >
                    <span
                      className={cn(
                        "font-mono text-sm tabular-nums",
                        selected ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {item.n}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
                        <item.Icon className="size-4 shrink-0" aria-hidden />
                        {item.title}
                      </span>
                      <span
                        className={cn(
                          "mt-1 block text-sm leading-relaxed",
                          selected ? "text-secondary-foreground/80" : "text-muted-foreground",
                        )}
                      >
                        {item.body}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="rounded-xl bg-card p-2 shadow-[var(--shadow-border)]">
            <div className="rounded-lg bg-secondary px-4 py-2.5 text-secondary-foreground">
              <p className="text-xs font-medium tracking-wide text-secondary-foreground/70">
                {step.panelKicker}
              </p>
              <p className="font-display text-xl font-semibold tracking-tight">{step.panelTitle}</p>
              <p className="text-sm text-secondary-foreground/75">{step.panelMeta}</p>
            </div>
            <img
              src={step.photo}
              alt={step.photoAlt}
              className="mt-2 aspect-[16/9] w-full rounded-lg object-cover"
            />
            <dl className="mt-2 divide-y divide-border overflow-hidden rounded-lg bg-muted/40">
              {step.rows.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4 px-4 py-3">
                  <dt className="text-sm text-muted-foreground">{row.label}</dt>
                  <dd className="text-right text-sm font-medium">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
