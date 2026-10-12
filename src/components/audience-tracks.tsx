import { useEffect, useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, Home, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MANAGE_EXTRA_MONTHLY,
  MANAGE_INCLUDED,
  MANAGE_MONTHLY,
  PROPERTY_MONTHLY,
  PRO_MONTHLY,
  SEAT_MONTHLY,
  SHOP_MONTHLY,
  dollars,
} from "@/lib/housefile/pricing";
import { trackCta } from "@/lib/track-cta";
import { cn } from "@/lib/utils";

const CHOICES = [
  {
    id: "homeowner",
    label: "Homeowner",
    Icon: Home,
    description:
      "One house file: photos, jobs, warranties, a Maintenance Schedule, and the shop you already call.",
    kicker: "For homeowners",
    title: "What is on the house file",
    body: "The record hangs on the address. You keep it. The shop that already worked the house stays named on it.",
    features: [
      {
        name: "Maintenance Schedule",
        detail:
          "Day, week, or month — unmarked is once a year. Notes for instructions (HVAC filter size on HVAC items). Alerts on or off. A service-record folder for every month you keep the file.",
      },
      {
        name: "House file",
        detail:
          "Photos, jobs, products, and warranties live at the address — rooms, systems, paint, roof, and the rest of the record.",
      },
      {
        name: "Same shop",
        detail:
          "The crew that already worked the house stays on the file. Call them back without starting over.",
      },
      {
        name: "Records",
        detail:
          "Completed work files by month. Warranties and products stay with the house when the crew leaves.",
      },
      {
        name: "Request Estimates",
        detail: `Pro ($${dollars(PRO_MONTHLY)} / month) asks shops that already service this street when you want new numbers.`,
      },
    ],
    price: `From $${dollars(PROPERTY_MONTHLY)} / month per property`,
    to: "/homeowner" as const,
    cta: "Start a Property Record",
    event: "homeowner_start",
  },
  {
    id: "contractor",
    label: "Contractor",
    Icon: Store,
    description:
      "Look up the house, quote onto the file, and stay the known shop for the next visit.",
    kicker: "For contractors",
    title: "What the shop gets",
    body: "Work written on the Property Record makes you the shop they call back. The estimate stays on the house for the next visit.",
    features: [
      {
        name: "Quote onto the file",
        detail:
          "Estimates write onto the Property Record. Accepted work, products, and warranties stay at the address.",
      },
      {
        name: "Known shop",
        detail:
          "Once you are on the file, you are the named shop for the next visit in that trade.",
      },
      {
        name: "Look up the house",
        detail:
          "If a record exists, photos and prior jobs are already there when you look up the house.",
      },
      {
        name: "Materials",
        detail:
          "Price from your book — suppliers, spreadsheets, or manual entry. Quote from what you already sell.",
      },
      {
        name: "Request Estimates",
        detail:
          "Catch local requests that match the categories you offer. Named jobs from a house stay private to your shop.",
      },
      {
        name: "Jobs and records",
        detail:
          "Current work stays open. Finished jobs file into month folders. Extra seats are $" +
          dollars(SEAT_MONTHLY) +
          " / month.",
      },
    ],
    price: `$${dollars(SHOP_MONTHLY)} / month per category`,
    to: "/shop" as const,
    cta: "Open a Shop",
    event: "contractor_lane",
  },
  {
    id: "manager",
    label: "Property Manager",
    Icon: Building2,
    description:
      "A portfolio of house files, a Maintenance Schedule for the office, and known shops first.",
    kicker: "For property managers",
    title: "What the office gets",
    body: "One Property Record per house. The calendar is the daily surface. The office keeps files and a schedule — no catalog, no quoting.",
    features: [
      {
        name: "Portfolio",
        detail: `${MANAGE_INCLUDED} Property Records on the base plan. Search by address or owner. Extra houses $${dollars(MANAGE_EXTRA_MONTHLY)} / month each.`,
      },
      {
        name: "Maintenance Schedule",
        detail:
          "Calendar for the office: notes, day / week / month or once a year, alerts. A service-record folder for every client month on each house.",
      },
      {
        name: "House files",
        detail:
          "Photos, jobs, warranties, and known shops on every address — the same record the homeowner can claim later.",
      },
      {
        name: "Same shops",
        detail:
          "Known shops first. Request Estimates when a house needs competing numbers from shops that cover the address.",
      },
      {
        name: "Records",
        detail:
          "See estimates already issued. Completed maintenance files by month so you can show a service record.",
      },
      {
        name: "Office seats",
        detail: `Owner is one seat. Extra people $${dollars(SEAT_MONTHLY)} / month — the people who walk the houses with you.`,
      },
    ],
    price: `From $${dollars(MANAGE_MONTHLY)} / month for ${MANAGE_INCLUDED} houses`,
    to: "/manage" as const,
    cta: "Open a portfolio",
    event: "manager_lane",
  },
] as const;

type ChoiceId = (typeof CHOICES)[number]["id"];

export function AudienceTracks() {
  const [choiceId, setChoiceId] = useState<ChoiceId | null>(null);
  const headingId = useId();
  const choice = CHOICES.find((item) => item.id === choiceId);

  useEffect(() => {
    if (!choiceId) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("choice-detail")?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  }, [choiceId]);

  return (
    <section id="choices" aria-labelledby={headingId} className="border-t border-border bg-background">
      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-5">
        <h2 id={headingId} className="text-center font-display text-3xl font-semibold tracking-tight">
          Choose one
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          Homeowner, contractor, or property manager. Open a path to see what it includes.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {CHOICES.map((item) => {
            const selected = item.id === choiceId;
            return (
              <article
                key={item.id}
                className={cn(
                  "flex flex-col rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6",
                  selected && "ring-2 ring-secondary",
                )}
              >
                <div className="flex items-center gap-2 text-secondary">
                  <item.Icon className="size-5 shrink-0" aria-hidden />
                  <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">
                    {item.label}
                  </h3>
                </div>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
                <Button
                  type="button"
                  variant={selected ? "secondary" : "outline"}
                  className="mt-6 min-h-12 w-full px-4 text-sm"
                  aria-expanded={selected}
                  aria-controls="choice-detail"
                  onClick={() => setChoiceId(item.id)}
                >
                  {item.label}
                </Button>
              </article>
            );
          })}
        </div>

        {choice ? (
          <article
            id="choice-detail"
            aria-live="polite"
            className="mt-8 scroll-mt-24 rounded-xl bg-card p-6 shadow-[var(--shadow-border)] sm:p-8"
          >
            <p className="text-sm font-medium tracking-wide text-secondary">{choice.kicker}</p>
            <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {choice.title}
            </h3>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">{choice.body}</p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {choice.features.map((feature) => (
                <li key={feature.name} className="rounded-lg bg-muted/50 p-4 shadow-[var(--shadow-border)]">
                  <p className="font-medium text-foreground">{feature.name}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{feature.detail}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted-foreground">{choice.price}</p>
            <Button asChild className="mt-4 min-h-12 bg-go px-5 text-sm text-go-foreground hover:opacity-90">
              <Link to={choice.to} onClick={() => trackCta(choice.event)}>
                {choice.cta}
              </Link>
            </Button>
          </article>
        ) : null}
      </div>
    </section>
  );
}
