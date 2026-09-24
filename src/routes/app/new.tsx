import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
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
import { InvoiceDoc } from "@/components/invoice-doc";
import { KitPicker } from "@/components/kit-picker";
import { SalesSeatPicker } from "@/components/sales-seat-picker";
import { applyPriceBook, linesNeedingBookCost, proposedCostKey, STARTER_BOOK } from "@/lib/housefile/book";
import { GUTTER_KIT_SEED, type WorkKit } from "@/lib/housefile/kits";
import {
  ESTIMATE_KEY,
  blankEstimateLine,
  catalogLinesForWork,
  catalogLinesFromBook,
  estimateReady,
  estimateTotal,
  joinKitIds,
  kitNamesLabel,
  linesFromKits,
  parseEstimateLines,
  seedEstimateLines,
  selectedKitIds,
  serializeEstimateLines,
  toQuoteLines,
} from "@/lib/housefile/estimate-lines";
import { money } from "@/lib/housefile/format";
import { isDrainageInvoice, type InvoiceView } from "@/lib/housefile/invoice";
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
  WORK_TYPES,
} from "@/lib/housefile/quote";
import { formatLine } from "@/lib/housefile/geocode";
import { namedShopInviteToken } from "@/lib/housefile/invite";
import {
  addCustomWork,
  createProposalFromWizard,
  getDashboard,
  getNamedWorkInvite,
  getQuoteHouse,
  getRfpByToken,
  listPriceBook,
  listTeam,
  listWorkKits,
  standardizeAddress,
} from "@/lib/housefile/server";
import { normalizePaymentLink } from "@/lib/housefile/payment";

const queryString = z.preprocess(
  (v) => (v == null || v === "" ? undefined : String(v)),
  z.string().optional(),
);

const inviteToken = z.preprocess((v) => namedShopInviteToken(v), z.string().optional());

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
  invite: inviteToken,
});

const STEPS = [
  { n: 1, label: "Address" },
  { n: 3, label: "Job" },
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
  const teamQ = useQuery({
    queryKey: ["team"],
    queryFn: () => listTeam(),
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
  const inviteQ = useQuery({
    queryKey: ["work-invite", search.invite],
    queryFn: () => getNamedWorkInvite({ data: search.invite! }),
    enabled: Boolean(user && search.invite),
  });
  const [takeoff, setTakeoff] = useState<Record<string, string>>({});
  const [housePhotos, setHousePhotos] = useState<string[]>([]);
  const lastPropertyId = useRef(propertyId);
  const [streetOpen, setStreetOpen] = useState(false);
  const [streetActive, setStreetActive] = useState(0);
  const streetBlur = useRef<number | null>(null);
  const [sent, setSent] = useState<Awaited<ReturnType<typeof createProposalFromWizard>> | null>(null);
  const [addingWork, setAddingWork] = useState(false);
  const [localCustom, setLocalCustom] = useState<string[]>([]);
  const [salesEmails, setSalesEmails] = useState<string[]>([]);
  const [paymentLink, setPaymentLink] = useState("");
  const salesSeeded = useRef(false);

  const offered = user
    ? workTypesFor(
        [...(dash.data?.company.trades ? dash.data.company.trades.split(",") : []), ...localCustom].join(","),
      )
    : [
        ...WORK_TYPES,
        ...localCustom
          .map((id) => workFromId(id))
          .filter((w): w is NonNullable<typeof w> => Boolean(w)),
      ];
  const work = workFromId(workId);
  useEffect(() => {
    if (salesSeeded.current) return;
    const shopLink = dash.data?.company.payment_link;
    if (shopLink && !paymentLink) setPaymentLink(shopLink);
    const members = teamQ.data?.members ?? [];
    if (!members.length) return;
    const mine = (user?.primaryEmail ?? "").trim().toLowerCase();
    const hit = members.find((m) => m.email.trim().toLowerCase() === mine);
    if (hit) {
      setSalesEmails([hit.email.trim().toLowerCase()]);
      salesSeeded.current = true;
      return;
    }
    const first = members[0]?.email.trim().toLowerCase();
    if (first) {
      setSalesEmails([first]);
      salesSeeded.current = true;
    }
  }, [dash.data?.company.payment_link, teamQ.data?.members, user?.primaryEmail, paymentLink]);
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
  const houses = dash.data?.properties ?? [];
  const existing = houses.find((p) => p.id === propertyId);
  const streetMatches = useMemo(() => {
    const raw = addressLine.trim();
    if (raw.length < 2 || !houses.length) return [];
    const needle = normalizeStreet(raw);
    const nameNeedle = raw.toLowerCase();
    return houses
      .filter((p) => {
        if (p.id === propertyId) return false;
        const street = normalizeStreet(p.address_line);
        const hay = `${p.homeowner_name} ${p.city} ${p.zip}`.toLowerCase();
        return (
          street.includes(needle) ||
          needle.includes(street) ||
          hay.includes(nameNeedle)
        );
      })
      .slice(0, 8);
  }, [houses, addressLine, propertyId]);
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
    const packed = inviteQ.data;
    if (!packed) return;
    const p = packed.property;
    setAddressLine(p.address_line);
    setCity(p.city);
    setState(p.state);
    setZip(p.zip);
    setHomeownerName(p.homeowner_name);
    setHomeownerEmail(p.homeowner_email);
    setHomeownerPhone(p.homeowner_phone ?? "");
    const invitePhotos = packed.photos
      .slice()
      .sort((a, b) => (a.category === "exterior" ? 0 : 1) - (b.category === "exterior" ? 0 : 1))
      .map((ph) => ph.src)
      .filter(Boolean)
      .slice(0, 8);
    if (invitePhotos.length) setHousePhotos(invitePhotos);
    setStep(3);
  }, [inviteQ.data?.invite.id]);

  useEffect(() => {
    if (propertyId || !dash.data) return;
    const fromInvite = inviteQ.data?.property.address_line;
    const street = search.address || fromInvite;
    if (!street) return;
    const needle = normalizeStreet(street);
    const zip = (inviteQ.data?.property.zip || search.zip || "").trim().toLowerCase();
    const hit = dash.data.properties.find((p) => {
      const sameStreet =
        normalizeStreet(p.address_line) === needle ||
        normalizeStreet(p.address_line).startsWith(needle) ||
        needle.startsWith(normalizeStreet(p.address_line));
      if (!sameStreet) return false;
      if (!zip) return true;
      return p.zip.trim().toLowerCase() === zip;
    });
    if (hit) setPropertyId(hit.id);
  }, [dash.data, search.address, search.zip, inviteQ.data, propertyId]);

  useEffect(() => {
    if (lastPropertyId.current === propertyId) return;
    lastPropertyId.current = propertyId;
    setHousePhotos([]);
  }, [propertyId]);

  useEffect(() => {
    const filePhotos = house.data?.photos ?? [];
    if (!filePhotos.length) return;
    setHousePhotos((cur) => {
      if (cur.length) return cur;
      return filePhotos.map((ph) => ph.src).filter(Boolean).slice(0, 8);
    });
  }, [house.data?.photos]);

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
        price: null,
        photos: [],
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
      const presetIds = search.kit
        ? search.kit
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
        : [];
      const presets = presetIds
        .map((id) => workKits.find((kit) => kit.id === id))
        .filter((kit): kit is WorkKit => Boolean(kit));
      if (presets.length) {
        return {
          __work: work.id,
          paint_scope: work.id === "paint" ? scope : "",
          __kit: joinKitIds(presets.map((kit) => kit.id)),
          __kit_name: kitNamesLabel(presets.map((kit) => kit.name)),
          [ESTIMATE_KEY]: serializeEstimateLines(linesFromKits(presets, items)),
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
  const quoteCatalog = useMemo(() => {
    const fromBook = catalogLinesFromBook(book);
    if (!work) return fromBook;
    const fromWork = catalogLinesForWork(work.id, workKits, takeoff.paint_scope);
    const seen = new Set(fromBook.map((row) => row.name.toLowerCase()));
    return [...fromBook, ...fromWork.filter((row) => !seen.has(row.name.toLowerCase()))];
  }, [book, work?.id, workKits, takeoff.paint_scope]);
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
  const quoteTitle =
    work?.name && takeoff.__kit_name
      ? `${work.name} — ${takeoff.__kit_name}`
      : work?.name || inviteQ.data?.invite.title || "Estimate";
  const invoicePreview = useMemo((): InvoiceView | null => {
    if (!isDrainageInvoice(quoteTitle)) return null;
    const billed = (estimateReady(estimate) ? toQuoteLines(estimate, book) : lines).filter((line) => line.included);
    const shop = dash.data?.company;
    return {
      proposal: {
        id: "preview00000invoice",
        sent_at: null,
        accepted_at: null,
        created_at: new Date().toISOString(),
        payment_link: normalizePaymentLink(paymentLink) || shop?.payment_link || null,
      },
      items: billed.map((line, i) => ({
        id: `preview-${i}`,
        name: line.name,
        description: line.description,
        qty: line.qty,
        unit: line.unit,
        unit_price: line.unit_price,
        included: true,
        option_id: line.optionId ?? null,
      })),
      property: {
        homeowner_name: existing?.homeowner_name || homeownerName || "Homeowner",
        homeowner_email: existing?.homeowner_email || homeownerEmail,
        homeowner_phone: homeownerPhone || existing?.homeowner_phone || null,
        address_line: existing?.address_line || addressLine || "Job address",
        city: existing?.city || city,
        state: existing?.state || state,
        zip: existing?.zip || zip,
      },
      company: {
        id: shop?.id ?? "preview-shop",
        name: shop?.name || "Your shop",
        trade: shop?.trade || "gutters",
        phone: shop?.phone ?? null,
        email: shop?.email ?? null,
        website: shop?.website ?? null,
        street: shop?.street ?? null,
        city: shop?.city ?? null,
        state: shop?.state ?? null,
        zip: shop?.zip ?? null,
        logo_src: shop?.logo_src ?? null,
        trade_logos: shop?.trade_logos ?? null,
        agreement: shop?.agreement ?? null,
        terms: shop?.terms ?? null,
        payment_terms: shop?.payment_terms ?? null,
        payment_link: normalizePaymentLink(paymentLink) || shop?.payment_link || null,
      },
      salesRep: invoiceSalesFromTeam(teamQ.data?.members ?? [], salesEmails, user)[0] ?? null,
      salesReps: invoiceSalesFromTeam(teamQ.data?.members ?? [], salesEmails, user),
    };
  }, [
    quoteTitle,
    estimate,
    book,
    lines,
    dash.data?.company,
    existing,
    homeownerName,
    homeownerEmail,
    homeownerPhone,
    addressLine,
    city,
    state,
    zip,
    user,
    paymentLink,
    salesEmails,
    teamQ.data?.members,
  ]);
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
          templateId: templateId || undefined,
          title: quoteTitle === "Estimate" ? undefined : quoteTitle,
          takeoff,
          coverPhoto: housePhotos[0],
          housePhotos,
          rfpToken: search.rfp,
          workInviteToken: search.invite,
          paymentLink,
          salesEmails,
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
    setStep(n);
  }

  function afterWorkPicked(id: string) {
    setWorkId(id);
    goToStep(addressReady ? 3 : 1);
  }

  function applyKits(kits: WorkKit[]) {
    if (!work) return;
    const items = user ? (bookQ.data?.items ?? []) : guestBook();
    const scope = takeoff.paint_scope || (search.template === "tmpl_ext_paint" ? "exterior" : "interior");
    if (!kits.length) {
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
      __kit: joinKitIds(kits.map((kit) => kit.id)),
      __kit_name: kitNamesLabel(kits.map((kit) => kit.name)),
      paint_scope: work.id === "paint" ? scope : s.paint_scope,
      [ESTIMATE_KEY]: serializeEstimateLines(linesFromKits(kits, items)),
    }));
  }

  function pickExistingHouse(house: (typeof houses)[number]) {
    setPropertyId(house.id);
    setAddressLine(house.address_line);
    setCity(house.city);
    setState(house.state);
    setZip(house.zip);
    setHomeownerName(house.homeowner_name);
    setHomeownerEmail(house.homeowner_email);
    setHomeownerPhone(house.homeowner_phone ?? "");
    setStreetOpen(false);
  }

  function onStreetChange(value: string) {
    setAddressLine(value);
    setStreetOpen(true);
    setStreetActive(0);
    if (!propertyId) return;
    const selected = houses.find((p) => p.id === propertyId);
    if (!selected || normalizeStreet(selected.address_line) !== normalizeStreet(value)) {
      setPropertyId("");
    }
  }

  function onStreetKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setStreetOpen(false);
      return;
    }
    if (!streetOpen || streetMatches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setStreetActive((i) => (i + 1) % streetMatches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setStreetActive((i) => (i - 1 + streetMatches.length) % streetMatches.length);
    } else if (e.key === "Enter" && streetMatches[streetActive]) {
      e.preventDefault();
      pickExistingHouse(streetMatches[streetActive]!);
    }
  }

  function toggleKit(kit: WorkKit) {
    const ids = selectedKitIds(takeoff.__kit);
    const nextIds = ids.includes(kit.id) ? ids.filter((id) => id !== kit.id) : [...ids, kit.id];
    const next = nextIds
      .map((id) => workKits.find((row) => row.id === id))
      .filter((row): row is WorkKit => Boolean(row));
    applyKits(next);
  }

  const shownStep = !addressReady ? 1 : step;

  if (sent) {
    if (sent.pending) {
      return (
        <div className="space-y-3">
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
      <div className="space-y-3">
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
    <div className="space-y-3">
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-medium tracking-tight">
          {inviteQ.data?.invite.title
            ? inviteQ.data.invite.title
            : work
              ? `${work.name} quote`
              : "Start a Quote"}
        </h1>
        {inviteQ.data ? (
          <p className="rounded-xl bg-card px-4 py-3 text-sm shadow-[var(--shadow-border)]">
            Named job at this address. Photos on the File. Quote from your materials.
            {inviteQ.data.invite.body ? ` ${inviteQ.data.invite.body}` : ""}
          </p>
        ) : search.invite && inviteQ.isError ? (
          <p className="text-sm text-destructive">
            {inviteQ.error instanceof Error ? inviteQ.error.message : "Could not open this named job."}
          </p>
        ) : null}
        <QuoteHouseBanner
          guest={!user}
          address={usingDemo ? MAPLE_DEMO.address : jobAddress}
          city={usingDemo ? MAPLE_DEMO.city : jobCity}
          state={usingDemo ? MAPLE_DEMO.state : jobState}
          zip={usingDemo ? MAPLE_DEMO.zip : jobZip}
          name={usingDemo ? MAPLE_DEMO.name : existing?.homeowner_name || homeownerName}
          photo={
            usingDemo
              ? MAPLE_DEMO.photo
              : user
                ? housePhotos[0] || existing?.cover_src || null
                : null
          }
          photos={usingDemo ? [MAPLE_DEMO.photo] : user ? housePhotos : []}
          lat={usingDemo ? null : geo.data?.lat}
          lng={usingDemo ? null : geo.data?.lng}
          onAddPhoto={
            user
              ? (src) =>
                  setHousePhotos((cur) => (cur.includes(src) || cur.length >= 8 ? cur : [...cur, src]))
              : undefined
          }
          onRemovePhoto={
            user ? (src) => setHousePhotos((cur) => cur.filter((p) => p !== src)) : undefined
          }
        />
        <WizardSteps step={shownStep} items={STEPS} onSelect={goToStep} />
      </div>

      {shownStep === 1 && (
        <div className="space-y-3">
          <p className="text-muted-foreground">
            Start with the address. If this house already has a file, the measurements come with it.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="relative sm:col-span-2">
              <Label htmlFor="street">Street/Existing Client house</Label>
              <Input
                id="street"
                value={addressLine}
                autoComplete="off"
                role="combobox"
                aria-expanded={streetOpen && streetMatches.length > 0}
                aria-controls="existing-houses"
                aria-autocomplete="list"
                placeholder="Start typing a street or client name"
                onChange={(e) => onStreetChange(e.target.value)}
                onFocus={() => setStreetOpen(true)}
                onBlur={() => {
                  streetBlur.current = window.setTimeout(() => setStreetOpen(false), 120);
                }}
                onKeyDown={onStreetKey}
              />
              {streetOpen && streetMatches.length > 0 ? (
                <ul
                  id="existing-houses"
                  role="listbox"
                  className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md bg-card py-1 shadow-[var(--shadow-border-hover)]"
                >
                  {streetMatches.map((house, i) => (
                    <li key={house.id} role="option" aria-selected={i === streetActive}>
                      <button
                        type="button"
                        className={
                          i === streetActive
                            ? "w-full px-3 py-2.5 text-left text-sm bg-muted"
                            : "w-full px-3 py-2.5 text-left text-sm hover:bg-muted"
                        }
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setStreetActive(i)}
                        onClick={() => pickExistingHouse(house)}
                      >
                        <span className="block font-medium">
                          {house.address_line}
                          {house.city ? `, ${house.city}` : ""}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {house.homeowner_name}
                          {house.zip ? ` · ${house.zip}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <Field label="City" value={city} onChange={setCity} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="State" value={state} onChange={setState} />
              <Field label="ZIP" value={zip} onChange={setZip} />
            </div>
            <Field label="Homeowner" value={homeownerName} onChange={setHomeownerName} />
            <Field label="Email" value={homeownerEmail} onChange={setHomeownerEmail} type="email" />
            <Field label="Phone" value={homeownerPhone} onChange={setHomeownerPhone} />
          </div>
          {existing && (
            <p className="text-sm text-muted-foreground">
              {existing.address_line}, {existing.city} · {existing.fact_count} facts already on file.
            </p>
          )}
          <Button type="button" disabled={user ? !addressReady : false} onClick={() => needShop(() => goToStep(3))}>
            Next — photos and measurements
          </Button>
        </div>
      )}

      {shownStep === 3 && (
        <div className="space-y-3">
          <p className="text-muted-foreground">
            Photos, then measurements, then the job from this category’s pre-saved templates. Work
            category is optional.
          </p>
          {workKits.length > 0 && work ? (
            <KitPicker
              kits={workKits}
              selectedIds={selectedKitIds(takeoff.__kit)}
              onToggle={toggleKit}
              onSkip={() => applyKits([])}
              skipped={Boolean(!takeoff.__kit && takeoff[ESTIMATE_KEY])}
            />
          ) : null}
          {housePhotos.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {housePhotos.length} house {housePhotos.length === 1 ? "photo" : "photos"} on this quote
              {housePhotos.length < 8 ? " — add more on the house card above." : "."}
            </p>
          )}
          {work ? (
            <TakeoffForm
              work={work}
              paintScope={takeoff.paint_scope}
              inputs={takeoff}
              onChange={(key, value) => setTakeoff((s) => ({ ...s, [key]: value }))}
              book={book}
              kits={workKits}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Skip the category if you already know the lines. Add them on the next screen from
              materials.
            </p>
          )}
          <details className="rounded-xl bg-card p-4 text-sm shadow-[var(--shadow-border)]">
            <summary className="cursor-pointer font-medium">Work category (optional)</summary>
            <div className="mt-3 space-y-3">
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
            </div>
          </details>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => goToStep(1)}>
              Back
            </Button>
            <Button type="button" onClick={() => goToStep(4)}>
              Pre-View before sending
            </Button>
          </div>
        </div>
      )}

      {shownStep === 4 && (
        <div className="space-y-3">
          <div>
            <p className="font-display text-2xl font-medium">
              {takeoff.__kit_name && work
                ? `${work.name} — ${takeoff.__kit_name}`
                : work?.name || inviteQ.data?.invite.title || "Estimate"}
            </p>
            <p className="text-sm text-muted-foreground">
              {propertyId
                ? `${existing?.address_line} · ${existing?.homeowner_name}`
                : `${addressLine}, ${city}, ${state} ${zip} · ${homeownerName}`}
            </p>
          </div>
          <EstimateSheet
            book={book}
            catalog={quoteCatalog}
            lines={estimate.length ? estimate : [blankEstimateLine()]}
            onChange={(next) =>
              setTakeoff((s) => ({ ...s, [ESTIMATE_KEY]: serializeEstimateLines(next) }))
            }
            workId={work?.id}
            paintScope={takeoff.paint_scope}
          />
          {invoicePreview ? <InvoiceDoc bundle={invoicePreview} /> : null}
          {user ? (
            <div className="space-y-4 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
              <div className="space-y-0.5">
                <Label htmlFor="quote-pay">Payment link</Label>
                <Input
                  id="quote-pay"
                  type="url"
                  inputMode="url"
                  placeholder="https://pay.example.com/your-shop"
                  value={paymentLink}
                  onChange={(e) => setPaymentLink(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Prints on the estimate and invoice. Defaults to the shop payment link.
                </p>
              </div>
              <SalesSeatPicker
                members={teamQ.data?.members ?? []}
                selected={salesEmails}
                onChange={setSalesEmails}
              />
            </div>
          ) : null}
          {lines.length > 0 && !estimateReady(estimate) && (
            <QuotePreview lines={lines} total={total} />
          )}
          <p className="text-sm text-muted-foreground">
            Send Estimate emails this to {homeownerName || existing?.homeowner_name || "the homeowner"}
            and the office on this File, then writes the measurements onto the Property Record.
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
                  <div key={line.bookId} className="space-y-0.5">
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

function invoiceSalesFromTeam(
  members: { email: string; name?: string | null }[],
  selected: string[],
  user: { displayName?: string | null; primaryEmail?: string | null } | null,
) {
  const byEmail = new Map(members.map((m) => [m.email.trim().toLowerCase(), m]));
  const emails = selected.map((e) => e.trim().toLowerCase()).filter(Boolean).slice(0, 2);
  if (!emails.length && user?.primaryEmail) emails.push(user.primaryEmail.trim().toLowerCase());
  return emails.map((email) => {
    const hit = byEmail.get(email);
    const mine = user?.primaryEmail?.trim().toLowerCase() === email;
    return {
      name: hit?.name || (mine ? user?.displayName : "") || email.split("@")[0] || email,
      email,
    };
  });
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
    <div className="space-y-0.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
