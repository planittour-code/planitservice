import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, Home, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MANAGE_MONTHLY,
  PROPERTY_MONTHLY,
  SHOP_MONTHLY,
  dollars,
} from "@/lib/housefile/pricing";
import { trackCta } from "@/lib/track-cta";
import { cn } from "@/lib/utils";

const TRACKS = [
  {
    id: "homeowner",
    label: "Homeowner",
    short: "House",
    Icon: Home,
    kicker: "Keep the file",
    title: "The file for the house.",
    body: "Photos, jobs, warranties, and the shops that already worked the address. Request Estimates is Pro — shops that already service this street.",
    points: [
      "Permanent record of work and warranties",
      "Named shop you know stays on Standard",
      "Pro asks shops that cover this street",
    ],
    price: `From $${dollars(PROPERTY_MONTHLY)} / month per property`,
    to: "/homeowner" as const,
    cta: "Start a Property Record",
    event: "homeowner_start",
  },
  {
    id: "contractor",
    label: "Contractor",
    short: "Shop",
    Icon: Store,
    kicker: "Stay the known shop",
    title: "Quote onto the file. Get the next visit.",
    body: "Work written on the Property Record makes you the shop they call back. Pick the categories you offer. Catch Request Estimates in that area.",
    points: [
      "Quote onto the file, not a one-off PDF",
      "$10 / month per category you offer",
      "Local Request Estimates match your trades",
    ],
    price: `$${dollars(SHOP_MONTHLY)} / month per category`,
    to: "/shop" as const,
    cta: "Open a Shop",
    event: "contractor_lane",
  },
  {
    id: "manager",
    label: "Manager",
    short: "Office",
    Icon: Building2,
    kicker: "Run the portfolio",
    title: "Records, a calendar, and bids.",
    body: "One Property Record per house. Maintenance calendar for the office. Known shops first. Request Estimates when a house needs numbers.",
    points: [
      "Ten houses on the base plan",
      "Maintenance calendar included",
      "Bids from shops that cover the address",
    ],
    price: `From $${dollars(MANAGE_MONTHLY)} / month for 10 houses`,
    to: "/manage" as const,
    cta: "Open a portfolio",
    event: "manager_lane",
  },
] as const;

type TrackId = (typeof TRACKS)[number]["id"];

export function AudienceTracks() {
  const [trackId, setTrackId] = useState<TrackId>("homeowner");
  const track = TRACKS.find((item) => item.id === trackId) ?? TRACKS[0];

  return (
    <section id="tracks" className="border-t border-border">
      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-5">
        <p className="text-center text-sm font-medium tracking-wide text-secondary">
          Choose how you use it
        </p>
        <h2 className="mt-2 text-center font-display text-3xl font-semibold tracking-tight">
          Three doors. Same house file.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          Pick a track. Pricing and the next step stay on that door.
        </p>

        <div
          role="tablist"
          aria-label="Choose a PlanitService track"
          className="mx-auto mt-8 grid max-w-xl grid-cols-3 gap-1 rounded-lg bg-muted p-1 shadow-[var(--shadow-border)]"
        >
          {TRACKS.map((item) => {
            const selected = item.id === track.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`track-tab-${item.id}`}
                aria-label={item.label}
                aria-selected={selected}
                aria-controls="track-panel"
                onClick={() => setTrackId(item.id)}
                className={cn(
                  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors duration-150 ease-[var(--ease-smooth-out)]",
                  selected
                    ? "bg-card text-foreground shadow-[var(--shadow-border)]"
                    : "bg-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <item.Icon className="size-3.5 shrink-0" aria-hidden />
                <span className="sm:hidden">{item.short}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </div>

        <article
          id="track-panel"
          role="tabpanel"
          aria-labelledby={`track-tab-${track.id}`}
          className="mx-auto mt-6 grid max-w-3xl gap-6 rounded-xl bg-card p-6 shadow-[var(--shadow-border)] sm:p-8 md:grid-cols-[1.1fr_0.9fr] md:items-center"
        >
          <div>
            <p className="text-sm font-medium tracking-wide text-secondary">{track.kicker}</p>
            <h3 className="mt-2 font-display text-3xl font-semibold tracking-tight">{track.title}</h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">{track.body}</p>
            <p className="mt-4 text-sm text-muted-foreground">{track.price}</p>
            <Button asChild className="mt-6 min-h-12 w-full bg-go text-go-foreground hover:opacity-90 sm:w-auto">
              <Link to={track.to} onClick={() => trackCta(track.event)}>
                {track.cta}
              </Link>
            </Button>
          </div>
          <ul className="space-y-3 rounded-lg bg-muted/50 p-4 text-sm leading-relaxed shadow-[var(--shadow-border)]">
            {track.points.map((point) => (
              <li key={point} className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
