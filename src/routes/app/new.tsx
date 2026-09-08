import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { CustomWorkDialog } from "@/components/custom-work-dialog";
import { QuoteHouseBanner, MAPLE_DEMO } from "@/components/quote-house-banner";
import { TradeGrid } from "@/components/trade-face";
import { QuotePreview, TakeoffForm } from "@/components/quote-takeoff";
import { WizardSteps } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EstimateSheet } from "@/components/estimate-sheet";
import { applyPriceBook, linesNeedingBookCost, pickKey, proposedCostKey, slotsForWork, STARTER_BOOK } from "@/lib/housefile/book";
import { GUTTER_KIT_SEED, type WorkKit } from "@/lib/housefile/kits";
import { cn } from "@/lib/utils";
import {
  ESTIMATE_KEY,
  blankEstimateLine,
  catalogLinesForWork,
  estimateReady,
  estimateTotal,
  linesFromKitItems,
  parseEstimateLines,
  seedEstimateLines,
  serializeEstimateLines,
  toQuoteLines,
} from "@/lib/housefile/estimate-lines";
import { money } from "@/lib/housefile/format";
import {
  buildQuote,
  customWorkId,
  defaultsFor,
  quoteTotal,
  takeoffReady,
  templateFor,
  workForTemplate,
  workFromId,
  workTypesFor,
} from "@/lib/housefile/quote";
import { formatLine } from "@/lib/housefile/geocode";
import {
  addCustomWork,
  createProposalFromWizard,
  getDashboard,
  getQuoteHouse,
  getRfpByToken,
  listPriceBook,
  listWorkKits,
  standardizeAddress,
} from "@/lib/housefile/server";

const queryString = z.preprocess(
  (v) => (v == null || v === "" ? undefined : String(v)),
  z.string().optional(),
);

const searchSchema = z.object({
  template: queryString,
  work: queryString,
  kit: queryString,
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
  { n: 3, label: "Details" },
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
  const kitsQ = useQuery({
    queryKey: ["work-kits"],
    queryFn: () => listWorkKits({ data: {} }),
    enabled: Boolean(user),
  });
  const [step, setStep] = useState(1);
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
  const [addingWork, setAddingWork] = useState(false);
  const [localCustom, setLocalCustom] = useState<string[]>([]);

  const offered = workTypesFor(
    [...(dash.data?.company.trades ? dash.data.company.trades.split(",") : []), ...localCustom].join(","),
  );
  const work = workFromId(workId);
  const addWork = useMutation({
    mutationFn: (name: string) => addCustomWork({ data: { name } }),
    onSuccess: (res) => {
      setLocalCustom((cur) => (cur.includes(res.workId) ? cur : [...cur, res.workId]));
      setWorkId(res.workId);
      setAddingWork(false);
      void dash.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add category"),
  });
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

  const workKits = useMemo(() => {
    if (user) return (kitsQ.data?.kits ?? []).filter((kit) => kit.work_id === workId);
    if (workId !== "gutters") return [];
    return GUTTER_KIT_SEED.map((kit, i) => ({
      id: `seed-${i}`,
      company_id: "guest",
      work_id: "gutters",
      name: kit.name,
      sort_order: i,
      created_at: "",
      items: kit.lines.map((line, j) => ({
        id: `seed-${i}-${j}`,
        kit_id: `seed-${i}`,
        sort_order: j,
        name: line.name,
        description: line.description,
        qty: line.qty ?? null,
        unit: line.unit ?? "ls",
        slot: line.slot ?? null,
      })),
    })) satisfies WorkKit[];
  }, [kitsQ.data?.kits, workId, user]);

  useEffect(() => {
    if (!work) return;
    if (user && !kitsQ.isFetched) return;
    const items = user ? (bookQ.data?.items ?? []) : guestBook();
    const scope = search.template === "tmpl_ext_paint" ? "exterior" : "interior";
    setTakeoff((prev) => {
      if (prev.__work === work.id) return prev;
      const preset = search.kit ? workKits.find((kit) => kit.id === search.kit) : undefined;
      if (preset) {
        return {
          __work: work.id,
          paint_scope: work.id === "paint" ? scope : "",
          __kit: preset.id,
          __kit_name: preset.name,
          [ESTIMATE_KEY]: serializeEstimateLines(linesFromKitItems(preset.items, items)),
        };
      }
      if (workKits.length > 0) {
        return {
          __work: work.id,
          paint_scope: work.id === "paint" ? scope : "",
          __kit: "",
          __kit_name: "",
        };
      }
      return {
        __work: work.id,
        paint_scope: work.id === "paint" ? scope : "",
        [ESTIMATE_KEY]: serializeEstimateLines(seedEstimateLines(work.id, items, scope)),
      };
    });
  }, [work?.id, user, kitsQ.isFetched, workKits.length, bookQ.data?.items.length, search.template, search.kit]);

  const book = user ? (bookQ.data?.items ?? []) : guestBook();
  const role = user ? (bookQ.data?.role ?? dash.data?.role ?? "owner") : "owner";
  const estimate = parseEstimateLines(takeoff[ESTIMATE_KEY]);
  const lines = useMemo(
    () => {
      if (estimateReady(estimate)) return toQuoteLines(estimate, book);
      return work ? applyPriceBook(buildQuote(work.id, takeoff), book, takeoff) : [];
    },
    [work?.id, takeoff, book],
  );
  const total = estimateReady(estimate) ? estimateTotal(estimate) : quoteTotal(lines);
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
          title: work?.name && takeoff.__kit_name ? `${work.name} — ${takeoff.__kit_name}` : work?.name,
          takeoff,
          coverPhoto: coverPhoto || undefined,
          rfpToken: search.rfp,
        },
      }),
    onSuccess: (result) => {
      setSent(result);
      toast.success(
        result.pending
          ? "Sent to the owner for approval"
          : result.emailed
            ? `Estimate emailed to ${result.homeownerEmail}`
            : "Estimate saved. Email did not go out — open the quote to try again.",
      );
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
    if (!estimate.some((l) => l.item.trim())) issues.push("Add a line item");
    return issues;
  })();
  const canSend = !user || (addressReady && sendBlockers.length === 0);

  function needShop(run: () => void) {
    if (user) {
      run();
      return;
    }
    window.location.href = "/shop/open";
  }

  function goToStep(n: number) {
    if (n <= 1) {
      setStep(1);
      return;
    }
    if (!addressReady) {
      setStep(1);
      return;
    }
    if (n >= 3 && !workId) {
      setStep(2);
      return;
    }
    setStep(n);
  }

  function afterWorkPicked(id: string) {
    setWorkId(id);
    goToStep(addressReady ? 3 : 1);
  }

  function applyKit(kit: WorkKit | null) {
    if (!work) return;
    const items = user ? (bookQ.data?.items ?? []) : guestBook();
    const scope = takeoff.paint_scope || (search.template === "tmpl_ext_paint" ? "exterior" : "interior");
    if (!kit) {
      setTakeoff((s) => ({
        ...s,
        __work: work.id,
        __kit: "",
        __kit_name: "",
        paint_scope: work.id === "paint" ? scope : s.paint_scope,
        [ESTIMATE_KEY]: serializeEstimateLines(seedEstimateLines(work.id, items, scope)),
      }));
      return;
    }
    setTakeoff((s) => ({
      ...s,
      __work: work.id,
      __kit: kit.id,
      __kit_name: kit.name,
      paint_scope: work.id === "paint" ? scope : s.paint_scope,
      [ESTIMATE_KEY]: serializeEstimateLines(linesFromKitItems(kit.items, items)),
    }));
  }

  const waitingOnKit = workKits.length > 0 && !takeoff.__kit && !takeoff[ESTIMATE_KEY];

  const shownStep = !addressReady ? 1 : step > 2 && !workId ? 2 : step;

  if (sent) {
    if (sent.pending) {
      return (
        <div className="mx-auto max-w-xl space-y-6">
          <h1 className="font-display text-3xl font-medium tracking-tight">Waiting on the owner.</h1>
          <p className="text-muted-foreground">
            You entered a cost that was not in materials. {sent.homeownerName} will not see this quote
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
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="font-display text-3xl font-medium tracking-tight">
          {sent.emailed ? "Estimate sent." : "Estimate saved."}
        </h1>
        <p className="text-muted-foreground">
          {sent.emailed
            ? `We emailed ${sent.homeownerName} at ${sent.homeownerEmail}. Replies land on this estimate. The measurements you just took are on the Property Record.`
            : `The estimate is on file for ${sent.homeownerName}. Open it to email it to ${sent.homeownerEmail}.`}
        </p>
        <Button asChild>
          <Link to="/app/proposals/$id" params={{ id: sent.proposalId }}>
            Open the estimate
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-medium tracking-tight">
          {work ? `${work.name} quote` : "Start a Quote"}
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
        <WizardSteps step={shownStep} items={STEPS} onSelect={goToStep} />
      </div>

      {shownStep === 1 && (
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
          <Button type="button" disabled={user ? !addressReady : false} onClick={() => needShop(() => goToStep(workId ? 3 : 2))}>
            Next — {workId ? "details" : "type of work"}
          </Button>
        </div>
      )}

      {shownStep === 2 && (
        <div className="space-y-4">
          <p className="text-muted-foreground">What are you quoting at this address?</p>
          <TradeGrid
            types={offered}
            onPick={afterWorkPicked}
            onAddCustom={() => setAddingWork(true)}
          />
          <CustomWorkDialog
            open={addingWork}
            onClose={() => setAddingWork(false)}
            onSave={async (name) => {
              if (user) {
                await addWork.mutateAsync(name);
                afterWorkPicked(customWorkId(name));
                return;
              }
              const id = customWorkId(name);
              setLocalCustom((cur) => (cur.includes(id) ? cur : [...cur, id]));
              setAddingWork(false);
              afterWorkPicked(id);
            }}
            busy={addWork.isPending}
          />
          <Button type="button" variant="ghost" onClick={() => goToStep(1)}>
            Back
          </Button>
        </div>
      )}

      {shownStep === 3 && work && (
        <div className="space-y-5">
          {user && !kitsQ.isFetched ? (
            <p className="text-muted-foreground">Loading sub-categories…</p>
          ) : (
            <>
              {workKits.length > 0 && (
                <KitPicker
                  kits={workKits}
                  selectedId={takeoff.__kit}
                  onPick={applyKit}
                  onSkip={() => applyKit(null)}
                  skipped={Boolean(!takeoff.__kit && takeoff[ESTIMATE_KEY])}
                />
              )}
              {waitingOnKit ? null : (
                <TakeoffForm
                  work={work}
                  paintScope={takeoff.paint_scope}
                  inputs={takeoff}
                  onChange={(key, value) => setTakeoff((s) => ({ ...s, [key]: value }))}
                  book={book}
                  kits={workKits}
                />
              )}
            </>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => goToStep(2)}>
              Back
            </Button>
            <Button type="button" disabled={waitingOnKit} onClick={() => goToStep(4)}>
              Review quote
            </Button>
          </div>
        </div>
      )}

      {shownStep === 4 && work && (
        <div className="space-y-5">
          <div>
            <p className="font-display text-2xl font-medium">
              {takeoff.__kit_name ? `${work.name} — ${takeoff.__kit_name}` : work.name}
            </p>
            <p className="text-sm text-muted-foreground">
              {propertyId
                ? `${existing?.address_line} · ${existing?.homeowner_name}`
                : `${addressLine}, ${city}, ${state} ${zip} · ${homeownerName}`}
            </p>
          </div>
          <EstimateSheet
            book={book}
            catalog={catalogLinesForWork(work.id, workKits, takeoff.paint_scope)}
            lines={estimate.length ? estimate : [blankEstimateLine()]}
            onChange={(next) =>
              setTakeoff((s) => ({ ...s, [ESTIMATE_KEY]: serializeEstimateLines(next) }))
            }
            workId={work.id}
            paintScope={takeoff.paint_scope}
          />
          {lines.length > 0 && !estimateReady(estimate) && (
            <QuotePreview lines={lines} total={total} showCost />
          )}
          <p className="text-sm text-muted-foreground">
            Send Estimate emails this to {homeownerName || existing?.homeowner_name || "the homeowner"}
            and writes the measurements onto the Property Record. They can reply to that email.
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
                  ? "A cost is missing from materials. The owner has to approve the number before the homeowner sees this quote."
                  : "Enter a cost for each product that is not in materials. Sending writes it into materials."}
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
            <Button type="button" variant="ghost" onClick={() => goToStep(3)}>
              Back
            </Button>
            <Button
              type="button"
              disabled={user ? create.isPending || !canSend : false}
              onClick={() => needShop(() => create.mutate())}
            >
              {create.isPending
                ? "Sending…"
                : role === "sales" && missingBookCost.length > 0
                  ? "Send for approval"
                  : "Send Estimate"}
            </Button>
          </div>
        </div>
      )}
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

function KitPicker({
  kits,
  selectedId,
  onPick,
  onSkip,
  skipped,
}: {
  kits: WorkKit[];
  selectedId?: string;
  onPick: (kit: WorkKit) => void;
  onSkip: () => void;
  skipped: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="font-display text-xl font-medium">Sub-category</p>
        <p className="text-sm text-muted-foreground">
          Starts the quote with that bundle. Every line stays editable.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {kits.map((kit) => {
          const on = selectedId === kit.id;
          return (
            <li key={kit.id}>
              <button
                type="button"
                onClick={() => {
                  if (selectedId === kit.id) return;
                  onPick(kit);
                }}
                className={cn(
                  "flex min-h-20 w-full flex-col items-start rounded-xl p-4 text-left shadow-[var(--shadow-border)]",
                  "transition-[box-shadow,opacity] duration-150 hover:opacity-95",
                  on ? "bg-primary text-primary-foreground" : "bg-card",
                )}
              >
                <p className="font-display text-lg font-medium">{kit.name}</p>
                <p className={cn("text-sm", on ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {kit.items.length} {kit.items.length === 1 ? "line item" : "line items"}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
      <Button type="button" variant={skipped ? "secondary" : "outline"} onClick={onSkip}>
        {skipped ? "Using a blank starter" : "Start without a kit"}
      </Button>
    </div>
  );
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
