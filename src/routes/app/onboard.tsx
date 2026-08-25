import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { WizardSteps } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { compressImage } from "@/lib/housefile/image";
import { WORK_TYPES } from "@/lib/housefile/quote";
import { completeOnboard, getDashboard } from "@/lib/housefile/server";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/onboard")({ component: Onboard });

const STEPS = [
  { n: 1, label: "Services" },
  { n: 2, label: "Price book" },
  { n: 3, label: "Branding" },
];

const DEFAULT_AGREEMENT =
  "This estimate is for the work listed at this address. Colors, products, and measurements stay on the House File so the next job is easier.";

const DEFAULT_TERMS =
  "This estimate is valid for 30 days. Work begins after written approval. Changes in scope are quoted separately. Payment is due as stated on the estimate. Warranties follow the manufacturer and the labor terms on each line.";

function Onboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const logoRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [trades, setTrades] = useState<string[]>(["paint", "roof", "gutters"]);
  const [book, setBook] = useState<"homedepot" | "lowes" | "starter">("homedepot");
  const [logo, setLogo] = useState<string | null>(null);
  const [agreement, setAgreement] = useState(DEFAULT_AGREEMENT);
  const [terms, setTerms] = useState(DEFAULT_TERMS);

  const save = useMutation({
    mutationFn: () =>
      completeOnboard({
        data: {
          name: name || dash.data?.company.name || "My shop",
          trades,
          book,
          logo: logo ?? undefined,
          agreement,
          terms,
        },
      }),
    onSuccess: async () => {
      toast.success("Shop is ready");
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void navigate({ to: "/app" });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not finish"),
  });

  if (dash.data?.company.onboarded_at) {
    return <Navigate to="/app" />;
  }

  function toggle(id: string) {
    setTrades((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-3">
        <p className="text-sm tracking-wide text-muted-foreground uppercase">Shop setup</p>
        <h1 className="font-display text-3xl font-medium tracking-tight">Open the shop.</h1>
        <p className="text-muted-foreground">
          Services, a price book, then your name on the estimate. Takes a few minutes.
        </p>
        <WizardSteps step={step} items={STEPS} />
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="shop">Shop name</Label>
            <Input
              id="shop"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={dash.data?.company.name || "Northside Home Co."}
            />
          </div>
          <p className="text-sm font-medium">What do you quote?</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {WORK_TYPES.map((w) => {
              const on = trades.includes(w.id);
              return (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => toggle(w.id)}
                    className={cn(
                      "h-full w-full rounded-xl p-4 text-left shadow-[var(--shadow-border)]",
                      on ? "bg-primary text-primary-foreground" : "bg-card",
                    )}
                  >
                    <p className="font-display text-lg font-medium">{w.name}</p>
                    <p className={cn("mt-1 text-sm", on ? "opacity-80" : "text-muted-foreground")}>
                      {w.blurb}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
          <Button type="button" disabled={trades.length === 0} onClick={() => setStep(2)}>
            Next — price book
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <p className="text-muted-foreground">
            Load a starter book from the aisle you actually buy. You can edit every cost later.
            This is not a live supplier feed.
          </p>
          <div className="grid gap-3">
            <BookChoice
              on={book === "homedepot"}
              title="Home Depot"
              body="BEHR, GAF Timberline, Andersen 100 Series, Hardie, Olympic."
              onClick={() => setBook("homedepot")}
            />
            <BookChoice
              on={book === "lowes"}
              title="Lowe’s"
              body="Valspar Reserve, Owens Corning Duration, Pella 250, LP SmartSide."
              onClick={() => setBook("lowes")}
            />
            <BookChoice
              on={book === "starter"}
              title="Shop book"
              body="Sherwin-Williams, GAF, Marvin, LeafFilter — the PlanitService starter."
              onClick={() => setBook("starter")}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="button" onClick={() => setStep(3)}>
              Next — branding
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Logo</Label>
            {logo ? (
              <img src={logo} alt="" className="h-16 w-auto rounded-md bg-card object-contain p-2 shadow-[var(--shadow-border)]" />
            ) : null}
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md bg-card px-4 text-sm shadow-[var(--shadow-border)]">
              {logo ? "Change logo" : "Upload logo"}
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void compressImage(file, 600)
                    .then(setLogo)
                    .catch((err) => toast.error(err instanceof Error ? err.message : "Could not read logo"));
                }}
              />
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ag">Language on the estimate</Label>
            <Textarea
              id="ag"
              rows={4}
              value={agreement}
              onChange={(e) => setAgreement(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              This is the cover note the homeowner sees with the number.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tm">Terms and conditions</Label>
            <Textarea id="tm" rows={6} value={terms} onChange={(e) => setTerms(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Opening shop…" : "Finish and open shop"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function BookChoice({
  on,
  title,
  body,
  onClick,
}: {
  on: boolean;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl p-4 text-left shadow-[var(--shadow-border)]",
        on ? "bg-primary text-primary-foreground" : "bg-card",
      )}
    >
      <p className="font-display text-lg font-medium">{title}</p>
      <p className={cn("mt-1 text-sm", on ? "opacity-80" : "text-muted-foreground")}>{body}</p>
    </button>
  );
}
