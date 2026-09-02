import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { OpenShopDialog } from "@/components/open-shop-dialog";
import { QuoteHouseBanner, MAPLE_DEMO } from "@/components/quote-house-banner";
import { InvitationLetter } from "@/components/house-panels";
import { QuotePreview, TakeoffForm } from "@/components/quote-takeoff";
import { WizardSteps } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { applyPriceBook, linesNeedingBookCost, pickKey, proposedCostKey, slotsForWork, STARTER_BOOK } from "@/lib/housefile/book";
import { money } from "@/lib/housefile/format";
import { applyLinePrices, defaultRates, priceKey } from "@/lib/housefile/rates";
import {
  WORK_BY_ID,
  buildQuote,
  defaultsFor,
  quoteTotal,
  takeoffReady,
  templateFor,
  workForTemplate,
  workTypesFor,
} from "@/lib/housefile/quote";
import { formatLine } from "@/lib/housefile/geocode";
import {
  createProposalFromWizard,
  getDashboard,
  getQuoteHouse,
  getRfpByToken,
  listPriceBook,
  listShopRates,
  standardizeAddress,
} from "@/lib/housefile/server";

const queryString = z.preprocess(
  (v) => (v == null || v === "" ? undefined : String(v)),
  z.string().optional(),
);

const searchSchema = z.object({
  template: queryString,
  work: queryString,
  property: queryString,
  address: queryString,
  city: queryString,
  state: queryString,
  zip: queryString,
  rfp: queryString,
});

const STEPS = [
  { n: 1, label: "Address" },
  { n: 2, label: "Work" },
  { n: 3, label: "Measure" },
  { n: 4, label: "Quote" },
];

export const Route = createFileRoute("/app/new")({
  validateSearch: (s) => searchSchema.parse(s),
  component: NewQuote,
});

function NewQuote() {
  const search = Route.useSearch();
  const { user } = useCurrentUserState();
  const dash = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
    enabled: Boolean(user),
  });
  const bookQ = useQuery({
    queryKey: ["price-book"],
    queryFn: () => listPriceBook(),
    enabled: Boolean(user),
  });
  const ratesQ = useQuery({
    queryKey: ["shop-rates"],
    queryFn: () => listShopRates(),
    enabled: Boolean(user),
  });
  const [step, setStep] = useState(search.work ? 3 : 1);
  const [gate, setGate] = useState(false);
  const [workId, setWorkId] = useState(
    search.work ?? workForTemplate(search.template ?? "")?.id ?? "",
  );
  const [propertyId, setPropertyId] = useState(search.property ?? "");
  const [homeownerName, setHomeownerName] = useState("");
  const [homeownerEmail, setHomeownerEmail] = useState("");
  const [homeownerPhone, setHomeownerPhone] = useState("");
  const [addressLine, setAddressLine] = useState(search.address ?? "");
  const [city, setCity] = useState(search.city ?? "");
  const [state, setState] = useState(search.state ?? "GA");
  const [zip, setZip] = useState(search.zip ?? "");
  const rfpQ = useQuery({
    queryKey: ["rfp", search.rfp],
    queryFn: () => getRfpByToken({ data: search.rfp! }),
    enabled: Boolean(search.rfp),
  });
  const [takeoff, setTakeoff] = useState<Record<string, string>>({});
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [sent, setSent] = useState<Awaited<ReturnType<typeof createProposalFromWizard>> | null>(null);

  const offered = workTypesFor(dash.data?.company.trades);
  const work = WORK_BY_ID[workId];
  const templateId = work ? templateFor(work, takeoff) : "";
  const existing = dash.data?.properties.find((p) => p.id === propertyId);
  const jobAddress = existing?.address_line || addressLine;
  const jobCity = existing?.city || city;
  const jobState = existing?.state || state;
  const jobZip = existing?.zip || zip;
  const usingDemo = !user && !jobAddress;
  const geo = useQuery({
    queryKey: ["geo", jobAddress, jobCity, jobState, jobZip],
    queryFn: () =>
      standardizeAddress({
        data: formatLine(jobAddress, jobCity, jobState, jobZip),
      }),
    enabled: Boolean(jobAddress),
    staleTime: 60_000,
  });
  const house = useQuery({
    queryKey: ["quote-house", propertyId],
    queryFn: () => getQuoteHouse({ data: propertyId }),
    enabled: Boolean(user && propertyId),
  });

  useEffect(() => {
    if (!user) return;
    setHomeownerName((n) => n || user.displayName || "");
    setHomeownerEmail((e) => e || user.primaryEmail || "");
  }, [user?.id, user?.displayName, user?.primaryEmail]);

  useEffect(() => {
    const rfp = rfpQ.data?.rfp;
    if (!rfp) return;
    setAddressLine(rfp.address_line);
    setCity(rfp.city);
    setState(rfp.state);
    setZip(rfp.zip);
    setHomeownerName(rfp.homeowner_name);
    if (rfp.work_id) setWorkId(rfp.work_id);
    setStep(3);
  }, [rfpQ.data?.rfp.id]);

  useEffect(() => {
    if (propertyId || !search.address || !dash.data) return;
    const needle = normalizeStreet(search.address);
    const hit = dash.data.properties.find(
      (p) =>
        normalizeStreet(p.address_line) === needle ||
        normalizeStreet(p.address_line).startsWith(needle) ||
        needle.startsWith(normalizeStreet(p.address_line)),
    );
    if (hit) setPropertyId(hit.id);
  }, [dash.data, search.address, propertyId]);

  useEffect(() => {
    if (!work) return;
    const facts = user ? (house.data?.facts ?? {}) : usingDemo ? MAPLE_DEMO.facts : {};
    const seeded = defaultsFor(work, facts);
    if (search.template === "tmpl_ext_paint") seeded.paint_scope = "exterior";
    const items = user ? (bookQ.data?.items ?? []) : guestBook();
    for (const slot of slotsForWork(work.id, seeded)) {
      const key = pickKey(slot.id);
      if (seeded[key]) continue;
      const first = items.find((b) => b.slot === slot.id && b.active !== false);
      if (first) seeded[key] = first.id;
    }
    setTakeoff(seeded);
  }, [work?.id, house.data?.property.id, bookQ.data?.items.length]);

  const book = user ? (bookQ.data?.items ?? []) : guestBook();
  const rates = user
    ? Object.fromEntries((ratesQ.data?.rates ?? []).map((r) => [r.key, r.amount]))
    : defaultRates();
  const hours = Object.fromEntries(
    (ratesQ.data?.rates ?? [])
      .filter((r) => r.hoursPerUnit != null)
      .map((r) => [r.key, r.hoursPerUnit as number]),
  );
  const role = user ? (bookQ.data?.role ?? dash.data?.role ?? "owner") : "owner";
  const lines = useMemo(
    () =>
      work
        ? applyLinePrices(applyPriceBook(buildQuote(work.id, takeoff, rates, hours), book, takeoff), takeoff)
        : [],
    [work?.id, takeoff, book, ratesQ.data?.rates],
  );
  const total = quoteTotal(lines);
  const missingBookCost = linesNeedingBookCost(lines, book);
  const proposedReady = missingBookCost.every((l) =>
    String(takeoff[`cost_${l.bookId}`] ?? "").trim(),
  );

  const create = useMutation({
    mutationFn: () =>
      createProposalFromWizard({
        data: {
          propertyId: propertyId || undefined,
          homeownerName: existing?.homeowner_name || homeownerName,
          homeownerEmail: existing?.homeowner_email || homeownerEmail,
          homeownerPhone,
          addressLine: existing?.address_line || addressLine,
          city: existing?.city || city,
          state: existing?.state || state,
          zip: existing?.zip || zip,
          templateId,
          takeoff,
          coverPhoto: coverPhoto || undefined,
          rfpToken: search.rfp,
        },
      }),
    onSuccess: (result) => {
      setSent(result);
      toast.success(result.pending ? "Sent to the owner for approval" : "Quote ready to send");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not send"),
  });

  const addressReady = Boolean(
    propertyId || (homeownerName.trim() && homeownerEmail.trim() && addressLine.trim()),
  );
  const sendBlockers = (() => {
    const issues: string[] = [];
    if (user && !propertyId) {
      if (!addressLine.trim()) issues.push("Street address");
      if (!homeownerName.trim()) issues.push("Homeowner name");
      if (!homeownerEmail.trim()) issues.push("Homeowner email");
    }
    if (work && !takeoffReady(work, takeoff)) issues.push("Finish the measurements");
    if (missingBookCost.length > 0 && !proposedReady) {
      issues.push("Enter a cost for each product that has none in the book");
    }
    return issues;
  })();
  const canSend = !user || (addressReady && sendBlockers.length === 0);

  function needShop(run: () => void) {
    if (user) {
      run();
      return;
    }
    setGate(true);
  }

  const shopNext = `/app/new?work=${encodeURIComponent(workId)}`;

  if (sent) {
    if (sent.pending) {
      return (
        <div className="mx-auto max-w-xl space-y-6">
          <h1 className="font-display text-3xl font-medium tracking-tight">Waiting on the owner.</h1>
          <p className="text-muted-foreground">
            You entered a cost that was not in the book. {sent.homeownerName} will not see this quote
            until the owner approves the number.
          </p>
          <Button asChild>
            <Link to="/app/proposals/$id" params={{ id: sent.proposalId }}>
              Open the draft
            </Link>
          </Button>
        </div>
      );
    }
    const housePath = `/house/${sent.houseToken}`;
    const proposalPath = `/p/${sent.proposalToken}`;
    const invitePath = `/invite/${sent.inviteToken}`;
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="font-display text-3xl font-medium tracking-tight">The quote is ready.</h1>
        <p className="text-muted-foreground">
          {sent.homeownerName} can open it without a password. The measurements you just took are on
          the property record for the next job.
        </p>
        <InvitationLetter
          email={sent.homeownerEmail}
          name={sent.homeownerName}
          address={sent.address}
          company={sent.companyName}
          invitePath={invitePath}
          housePath={housePath}
          proposalPath={proposalPath}
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/app/proposals/$id" params={{ id: sent.proposalId }}>
              Open the quote
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/app/properties/$id" params={{ id: sent.propertyId }}>
              Open the property record
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/p/$token" params={{ token: sent.proposalToken }}>
              Preview as homeowner
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-medium tracking-tight">
          {work ? `${work.name} quote` : "New quote"}
        </h1>
        <QuoteHouseBanner
          guest={!user}
          address={usingDemo ? MAPLE_DEMO.address : jobAddress}
          city={usingDemo ? MAPLE_DEMO.city : jobCity}
          state={usingDemo ? MAPLE_DEMO.state : jobState}
          zip={usingDemo ? MAPLE_DEMO.zip : jobZip}
          name={usingDemo ? MAPLE_DEMO.name : existing?.homeowner_name || homeownerName}
          photo={
            usingDemo ? MAPLE_DEMO.photo : user ? coverPhoto || existing?.cover_src || null : null
          }
          lat={usingDemo ? null : geo.data?.lat}
          lng={usingDemo ? null : geo.data?.lng}
          onAddPhoto={user ? setCoverPhoto : undefined}
        />
        <WizardSteps step={step} items={STEPS} />
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <p className="text-muted-foreground">
            Start with the address. If this house already has a file, the measurements come with it.
          </p>
          {(dash.data?.properties.length ?? 0) > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="existing">Existing house</Label>
              <select
                id="existing"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="flex h-11 w-full rounded-md bg-card px-3 text-sm shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option value="">New address</option>
                {dash.data?.properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.address_line} — {p.homeowner_name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!propertyId && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Street" value={addressLine} onChange={setAddressLine} />
              </div>
              <Field label="City" value={city} onChange={setCity} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="State" value={state} onChange={setState} />
                <Field label="ZIP" value={zip} onChange={setZip} />
              </div>
              <Field label="Homeowner" value={homeownerName} onChange={setHomeownerName} />
              <Field label="Email" value={homeownerEmail} onChange={setHomeownerEmail} type="email" />
              <Field label="Phone" value={homeownerPhone} onChange={setHomeownerPhone} />
            </div>
          )}
          {existing && (
            <p className="text-sm text-muted-foreground">
              {existing.address_line}, {existing.city} · {existing.fact_count} facts already on file.
            </p>
          )}
          <Button type="button" disabled={user ? !addressReady : false} onClick={() => needShop(() => setStep(workId ? 3 : 2))}>
            Next — {workId ? "measure" : "type of work"}
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-muted-foreground">What are you quoting at this address?</p>
          <div className="grid gap-3">
            {offered.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => {
                  setWorkId(w.id);
                  setStep(3);
                }}
                className="rounded-xl bg-card p-4 text-left shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]"
              >
                <p className="text-xs tracking-wide text-muted-foreground uppercase">{w.trade}</p>
                <p className="font-display text-lg font-medium">{w.name}</p>
                <p className="text-sm text-muted-foreground">{w.blurb}</p>
              </button>
            ))}
          </div>
          <Button type="button" variant="ghost" onClick={() => setStep(1)}>
            Back
          </Button>
        </div>
      )}

      {step === 3 && work && (
        <div className="space-y-5">
          <TakeoffForm
            work={work}
            inputs={takeoff}
            onChange={(key, value) => setTakeoff((s) => ({ ...s, [key]: value }))}
            book={book}
            role={role}
            rates={rates}
            hours={hours}
            laborRate={rates.labor_rate ?? 65}
          />
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button type="button" disabled={!takeoffReady(work, takeoff)} onClick={() => setStep(4)}>
              Review quote
            </Button>
          </div>
        </div>
      )}

      {step === 4 && work && (
        <div className="space-y-5">
          <div>
            <p className="font-display text-2xl font-medium">{work.name}</p>
            <p className="text-sm text-muted-foreground">
              {propertyId
                ? `${existing?.address_line} · ${existing?.homeowner_name}`
                : `${addressLine}, ${city}, ${state} ${zip} · ${homeownerName}`}
            </p>
          </div>
          <QuotePreview
            lines={lines}
            total={total}
            showCost
            laborRate={rates.labor_rate ?? 65}
            onPriceChange={(name, value) =>
              setTakeoff((s) => ({ ...s, [priceKey(name)]: value }))
            }
          />
          <div className="relative z-10 space-y-5">
          <p className="text-sm text-muted-foreground">
            Sending writes these quantities into a first draft and copies the measurements onto the
            property record. {homeownerName || existing?.homeowner_name || "The homeowner"} can revise
            colors and optional work.
          </p>
          {!propertyId && (
            <div className="grid gap-3 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:grid-cols-2">
              <p className="text-sm text-muted-foreground sm:col-span-2">
                Who should receive this estimate? We need a name and email to send it.
              </p>
              <Field label="Homeowner" value={homeownerName} onChange={setHomeownerName} />
              <Field
                label="Email"
                value={homeownerEmail}
                onChange={setHomeownerEmail}
                type="email"
              />
            </div>
          )}
          {missingBookCost.length > 0 && (
            <div className="space-y-3 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
              <p className="text-sm text-muted-foreground">
                {role === "sales"
                  ? "A cost is missing from the book. The owner has to approve the number before the homeowner sees this quote."
                  : "Enter a cost for each product that is not in the book. Sending writes it into the book."}
              </p>
              {missingBookCost.map((line) =>
                line.bookId ? (
                  <div key={line.bookId} className="space-y-1.5">
                    <Label htmlFor={`send-cost-${line.bookId}`}>
                      {line.name} cost ({line.unit})
                    </Label>
                    <Input
                      id={`send-cost-${line.bookId}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      placeholder="What the yard will charge"
                      value={takeoff[proposedCostKey(line.bookId)] ?? ""}
                      onChange={(e) =>
                        setTakeoff((s) => ({ ...s, [proposedCostKey(line.bookId!)]: e.target.value }))
                      }
                    />
                  </div>
                ) : null,
              )}
            </div>
          )}
          {sendBlockers.length > 0 && (
            <p className="text-sm text-destructive">
              Need {sendBlockers.join(", ").toLowerCase()} before this can go out.
            </p>
          )}
          <p className="font-display text-3xl font-medium tabular-nums">{money(total)}</p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button
              type="button"
              disabled={user ? create.isPending || !canSend : false}
              onClick={() => needShop(() => create.mutate())}
            >
              {create.isPending
                ? "Writing quote…"
                : role === "sales" && missingBookCost.length > 0
                  ? "Send for approval"
                  : "Send this quote"}
            </Button>
          </div>
          </div>
        </div>
      )}
      <OpenShopDialog
        open={gate}
        onClose={() => setGate(false)}
        workName={work?.name}
        next={shopNext}
      />
    </div>
  );
}

function guestBook() {
  return STARTER_BOOK.map((row, i) => ({
    ...row,
    id: `guest-${i}`,
    company_id: "guest",
    active: true,
  }));
}

function normalizeStreet(value: string) {
  return value
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\b(northwest|northeast|southwest|southeast)\b/g, (m) =>
      m === "northwest" ? "nw" : m === "northeast" ? "ne" : m === "southwest" ? "sw" : "se",
    )
    .replace(/\b(street|st)\b/g, "st")
    .replace(/\b(road|rd)\b/g, "rd")
    .replace(/\b(drive|dr)\b/g, "dr")
    .replace(/\b(avenue|ave)\b/g, "ave")
    .replace(/\b(court|ct)\b/g, "ct")
    .replace(/\b(lane|ln)\b/g, "ln")
    .replace(/\b(boulevard|blvd)\b/g, "blvd")
    .replace(/\s+/g, " ")
    .trim();
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  const id = label.toLowerCase();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
