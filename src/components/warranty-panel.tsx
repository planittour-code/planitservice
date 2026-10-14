import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Camera, CreditCard, ScanBarcode } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { InvoiceDoc } from "@/components/invoice-doc";
import { RecordSection } from "@/components/house-panels";
import { TradeGrid } from "@/components/trade-face";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_PHOTO } from "@/lib/housefile/fields";
import { shortDate } from "@/lib/housefile/format";
import { compressImage } from "@/lib/housefile/image";
import { WORK_BY_ID, WORK_TYPES } from "@/lib/housefile/quote";
import {
  deleteWarrantyContractor,
  deleteWarrantyHome,
  deleteWarrantyPublic,
  getTradeInvoice,
  saveWarrantyContractor,
  saveWarrantyHome,
  saveWarrantyPublic,
} from "@/lib/housefile/server";
import type { HouseFile, JobSpec, WarrantyRecord } from "@/lib/housefile/types";
import {
  WARRANTY_COVERAGE,
  inheritedWarrantyItems,
  jobsForTrade,
  pickProposalIdForTrade,
  warrantiesForTrade,
  warrantyExpiry,
} from "@/lib/housefile/warranty";
import { cn } from "@/lib/utils";

type Mode = "homeowner" | "contractor";

type Draft = {
  id?: string;
  productName: string;
  manufacturer: string;
  serialNumber: string;
  modelNumber: string;
  color: string;
  sku: string;
  purchasedOn: string;
  installedOn: string;
  warrantyYears: string;
  warrantyExpires: string;
  coverage: string;
  installerName: string;
  registered: boolean;
  registerUrl: string;
  claimPhone: string;
  notes: string;
  barcodeSrc: string | null;
  cardSrc: string | null;
};

const emptyDraft = (): Draft => ({
  productName: "",
  manufacturer: "",
  serialNumber: "",
  modelNumber: "",
  color: "",
  sku: "",
  purchasedOn: "",
  installedOn: "",
  warrantyYears: "",
  warrantyExpires: "",
  coverage: "materials",
  installerName: "",
  registered: false,
  registerUrl: "",
  claimPhone: "",
  notes: "",
  barcodeSrc: null,
  cardSrc: null,
});

function isoDay(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

function fromRecord(row: WarrantyRecord): Draft {
  return {
    id: row.id,
    productName: row.product_name ?? "",
    manufacturer: row.manufacturer ?? "",
    serialNumber: row.serial_number ?? "",
    modelNumber: row.model_number ?? "",
    color: row.color ?? "",
    sku: row.sku ?? "",
    purchasedOn: isoDay(row.purchased_on),
    installedOn: isoDay(row.installed_on),
    warrantyYears: row.warranty_years == null ? "" : String(row.warranty_years),
    warrantyExpires: isoDay(row.warranty_expires),
    coverage: row.coverage || "materials",
    installerName: row.installer_name ?? "",
    registered: Boolean(row.registered),
    registerUrl: row.register_url ?? "",
    claimPhone: row.claim_phone ?? "",
    notes: row.notes ?? "",
    barcodeSrc: row.barcode_src,
    cardSrc: row.card_src,
  };
}

function fromSpec(
  spec: JobSpec & { jobTitle: string; completed: string },
  installer: string,
): Draft {
  return {
    ...emptyDraft(),
    productName: spec.product_name || spec.label,
    manufacturer: spec.manufacturer ?? "",
    color: spec.value && spec.kind === "color" ? spec.value : "",
    sku: spec.value && spec.kind !== "color" ? spec.value : "",
    installedOn: isoDay(spec.completed),
    warrantyYears: spec.warranty_years == null ? "" : String(spec.warranty_years),
    warrantyExpires: isoDay(spec.warranty_expires),
    coverage: "materials",
    installerName: installer,
    notes: spec.warranty_terms ?? "",
  };
}

function tradesForPicker(file: HouseFile) {
  const scored = WORK_TYPES.map((work) => {
    const hasJob = jobsForTrade(file.jobs, work.id).length > 0;
    const hasCard = warrantiesForTrade(file.warranties ?? [], work.id).length > 0;
    return { work, score: (hasJob ? 2 : 0) + (hasCard ? 1 : 0) };
  });
  return scored.sort((a, b) => b.score - a.score).map((row) => row.work);
}

function manufacturerMark(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "M";
}

export function WarrantyList({
  file,
  defaultOpen,
  mode = "homeowner",
  token,
  onChanged,
}: {
  file: HouseFile;
  defaultOpen?: boolean;
  mode?: Mode;
  token?: string;
  onChanged?: () => void;
}) {
  const [tradeId, setTradeId] = useState<string | null>(null);
  const warranties = file.warranties ?? [];
  const inherited = inheritedWarrantyItems(file.jobs);
  const makers = [
    ...new Map(
      [...warranties, ...inherited]
        .map((w) => w.manufacturer?.trim())
        .filter((name): name is string => Boolean(name))
        .map((name) => [name.toLowerCase(), name]),
    ).values(),
  ];
  const filed = warranties.length + inherited.length;
  const work = tradeId ? WORK_BY_ID[tradeId] : undefined;

  return (
    <RecordSection
      defaultOpen={defaultOpen}
      title="Manufacturer warranties"
      blurb="Pick the trade, then file the invoice and the materials card for this address."
      photo={work ? CATEGORY_PHOTO[work.id] ?? CATEGORY_PHOTO.systems : CATEGORY_PHOTO.systems}
      countLabel={`${filed} on file`}
      chips={
        makers.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {makers.map((name) => (
              <li
                key={name}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted py-0.5 pr-2.5 pl-0.5 text-xs font-semibold"
              >
                <span className="grid size-6 place-items-center rounded-full bg-secondary text-[10px] font-bold text-white">
                  {manufacturerMark(name)}
                </span>
                {name}
              </li>
            ))}
          </ul>
        ) : undefined
      }
    >
      {tradeId && work ? (
        <TradeWarranty
          file={file}
          tradeId={tradeId}
          tradeName={work.name}
          mode={mode}
          token={token}
          onBack={() => setTradeId(null)}
          onChanged={onChanged}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Choose the work you want the warranty for — gutters, roof, paint, and the rest. Each
            tile opens that trade’s invoice and a Materials card for the barcode, the paper
            warranty if one was mailed, and notes.
          </p>
          <TradeGrid types={tradesForPicker(file)} onPick={setTradeId} compact />
        </div>
      )}
    </RecordSection>
  );
}

function TradeWarranty({
  file,
  tradeId,
  tradeName,
  mode,
  token,
  onBack,
  onChanged,
}: {
  file: HouseFile;
  tradeId: string;
  tradeName: string;
  mode: Mode;
  token?: string;
  onBack: () => void;
  onChanged?: () => void;
}) {
  const jobs = jobsForTrade(file.jobs, tradeId);
  const proposalId = pickProposalIdForTrade(file.jobs, file.proposals, tradeId);
  const saved = warrantiesForTrade(file.warranties ?? [], tradeId);
  const inherited = inheritedWarrantyItems(file.jobs, tradeId);
  const invoice = useQuery({
    queryKey: ["trade-invoice", file.property.id, proposalId, token ?? ""],
    queryFn: () =>
      getTradeInvoice({
        data: { propertyId: file.property.id, proposalId: proposalId!, token },
      }),
    enabled: Boolean(proposalId),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden />
          Trades
        </Button>
        <p className="font-display text-lg font-medium">{tradeName}</p>
      </div>

      {proposalId ? (
        invoice.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading the invoice for this work…</p>
        ) : invoice.data ? (
          <div className="overflow-x-auto rounded-xl">
            <InvoiceDoc bundle={invoice.data} showLinePrices />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {invoice.error instanceof Error ? invoice.error.message : "Invoice could not be opened."}
          </p>
        )
      ) : (
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
          No invoice on file for {tradeName.toLowerCase()} yet. You can still save the materials
          card from a barcode or the paper warranty.
        </p>
      )}

      {jobs.length ? (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {jobs.map((job) => (
            <li key={job.id}>
              {job.title} · {shortDate(job.completed_at)}
            </li>
          ))}
        </ul>
      ) : null}

      {inherited.length ? (
        <div className="space-y-2">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">From completed work</p>
          <ul className="space-y-2">
            {inherited.map((item) => (
              <li key={item.id} className="rounded-md bg-background px-3 py-2 shadow-[var(--shadow-border)]">
                <p className="font-medium">
                  {item.manufacturer ? `${item.manufacturer} ` : ""}
                  {item.product_name || item.label}
                </p>
                {item.warranty_terms ? (
                  <p className="text-sm text-muted-foreground">{item.warranty_terms}</p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.jobTitle} · {shortDate(item.completed)}
                  {item.warranty_expires ? ` · through ${shortDate(item.warranty_expires)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {saved.map((row) => (
        <MaterialsCard
          key={row.id}
          file={file}
          tradeId={tradeId}
          mode={mode}
          token={token}
          proposalId={proposalId}
          jobId={jobs[0]?.id ?? null}
          initial={fromRecord(row)}
          onChanged={onChanged}
        />
      ))}

      <MaterialsCard
        key={`new-${tradeId}-${saved.length}`}
        file={file}
        tradeId={tradeId}
        mode={mode}
        token={token}
        proposalId={proposalId}
        jobId={jobs[0]?.id ?? null}
        initial={emptyDraft()}
        installerHint={file.company.name}
        installedHint={isoDay(jobs[0]?.completed_at)}
        seedSpecs={inherited}
        onChanged={onChanged}
      />
    </div>
  );
}

function MaterialsCard({
  file,
  tradeId,
  mode,
  token,
  proposalId,
  jobId,
  initial,
  installerHint,
  installedHint,
  seedSpecs,
  onChanged,
}: {
  file: HouseFile;
  tradeId: string;
  mode: Mode;
  token?: string;
  proposalId: string | null;
  jobId: string | null;
  initial: Draft;
  installerHint?: string;
  installedHint?: string;
  seedSpecs?: (JobSpec & { jobTitle: string; completed: string })[];
  onChanged?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => {
    if (initial.id) return initial;
    return {
      ...initial,
      installerName: initial.installerName || installerHint || "",
      installedOn: initial.installedOn || installedHint || "",
    };
  });
  const [busy, setBusy] = useState(false);
  const editing = Boolean(draft.id);

  useEffect(() => {
    if (!draft.warrantyExpires && draft.installedOn && draft.warrantyYears) {
      const years = Number(draft.warrantyYears);
      const next = warrantyExpiry(draft.installedOn, Number.isFinite(years) ? years : null);
      if (next) setDraft((cur) => (cur.warrantyExpires ? cur : { ...cur, warrantyExpires: next }));
    }
  }, [draft.installedOn, draft.warrantyYears, draft.warrantyExpires]);

  function patch(partial: Partial<Draft>) {
    setDraft((cur) => ({ ...cur, ...partial }));
  }

  async function save() {
    const hasContent =
      Boolean(draft.manufacturer.trim()) ||
      Boolean(draft.productName.trim()) ||
      Boolean(draft.serialNumber.trim()) ||
      Boolean(draft.notes.trim()) ||
      Boolean(draft.barcodeSrc) ||
      Boolean(draft.cardSrc);
    if (!hasContent) {
      toast.error("Add a product, a photo, or a comment first.");
      return;
    }
    setBusy(true);
    try {
      const yearsRaw = draft.warrantyYears.trim();
      const years = yearsRaw === "" ? null : Number(yearsRaw);
      const payload = {
        id: draft.id,
        propertyId: file.property.id,
        tradeId,
        jobId,
        proposalId,
        productName: draft.productName,
        manufacturer: draft.manufacturer,
        serialNumber: draft.serialNumber,
        modelNumber: draft.modelNumber,
        color: draft.color,
        sku: draft.sku,
        purchasedOn: draft.purchasedOn,
        installedOn: draft.installedOn,
        warrantyYears: years != null && Number.isFinite(years) ? years : null,
        warrantyExpires: draft.warrantyExpires,
        coverage: draft.coverage,
        installerName: draft.installerName,
        registered: draft.registered,
        registerUrl: draft.registerUrl,
        claimPhone: draft.claimPhone,
        notes: draft.notes,
        barcodeSrc: draft.barcodeSrc,
        cardSrc: draft.cardSrc,
      };
      if (mode === "contractor") {
        await saveWarrantyContractor({ data: payload });
      } else if (token) {
        await saveWarrantyPublic({ data: { ...payload, token } });
      } else {
        await saveWarrantyHome({ data: payload });
      }
      toast.success(editing ? "Warranty card saved" : "Materials added to this address");
      if (!editing) setDraft(emptyDraft());
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the warranty");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!draft.id) return;
    if (!window.confirm("Remove this warranty card from the record?")) return;
    setBusy(true);
    try {
      if (mode === "contractor") {
        await deleteWarrantyContractor({ data: { propertyId: file.property.id, warrantyId: draft.id } });
      } else if (token) {
        await deleteWarrantyPublic({ data: { token, warrantyId: draft.id } });
      } else {
        await deleteWarrantyHome({ data: { propertyId: file.property.id, warrantyId: draft.id } });
      }
      toast.success("Warranty card removed");
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-3 rounded-xl bg-background p-3 shadow-[var(--shadow-border)] sm:p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div>
        <h3 className="font-display text-lg font-medium">Materials</h3>
        <p className="text-sm text-muted-foreground">
          Photograph the barcode and the physical card if one was sent. Serial, dates, and who
          installed it stay with the house when it sells.
        </p>
      </div>

      {seedSpecs?.length && !editing ? (
        <div className="flex flex-wrap gap-1.5">
          {seedSpecs.map((spec) => (
            <Button
              key={spec.id}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDraft(fromSpec(spec, installerHint || file.company.name))}
            >
              Fill from {spec.product_name || spec.label}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <PhotoSlot
          label="Barcode"
          hint="Box, coil, or product barcode"
          icon={<ScanBarcode className="size-5 text-primary" />}
          src={draft.barcodeSrc}
          disabled={busy}
          onSrc={(src) => patch({ barcodeSrc: src })}
        />
        <PhotoSlot
          label="Warranty card"
          hint="Paper card if the manufacturer mailed one"
          icon={<CreditCard className="size-5 text-primary" />}
          src={draft.cardSrc}
          disabled={busy}
          onSrc={(src) => patch({ cardSrc: src })}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Manufacturer" htmlFor={`mfr-${draft.id ?? "new"}`}>
          <Input
            id={`mfr-${draft.id ?? "new"}`}
            value={draft.manufacturer}
            onChange={(e) => patch({ manufacturer: e.target.value })}
            placeholder="Amerimax"
          />
        </Field>
        <Field label="Product" htmlFor={`prod-${draft.id ?? "new"}`}>
          <Input
            id={`prod-${draft.id ?? "new"}`}
            value={draft.productName}
            onChange={(e) => patch({ productName: e.target.value })}
            placeholder="6-inch K-style .027"
          />
        </Field>
        <Field label="Serial number" htmlFor={`ser-${draft.id ?? "new"}`}>
          <Input
            id={`ser-${draft.id ?? "new"}`}
            value={draft.serialNumber}
            onChange={(e) => patch({ serialNumber: e.target.value })}
            placeholder="From the barcode or card"
          />
        </Field>
        <Field label="Model / SKU" htmlFor={`sku-${draft.id ?? "new"}`}>
          <Input
            id={`sku-${draft.id ?? "new"}`}
            value={draft.modelNumber || draft.sku}
            onChange={(e) => patch({ modelNumber: e.target.value, sku: e.target.value })}
            placeholder="Model or SKU"
          />
        </Field>
        <Field label="Color" htmlFor={`color-${draft.id ?? "new"}`}>
          <Input
            id={`color-${draft.id ?? "new"}`}
            value={draft.color}
            onChange={(e) => patch({ color: e.target.value })}
            placeholder="Heritage Cream"
          />
        </Field>
        <Field label="Coverage" htmlFor={`cov-${draft.id ?? "new"}`}>
          <select
            id={`cov-${draft.id ?? "new"}`}
            value={draft.coverage}
            onChange={(e) => patch({ coverage: e.target.value })}
            className="flex h-7 w-full rounded-md bg-card px-2 text-xs text-foreground shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {WARRANTY_COVERAGE.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Installed on" htmlFor={`inst-${draft.id ?? "new"}`}>
          <Input
            id={`inst-${draft.id ?? "new"}`}
            type="date"
            value={draft.installedOn}
            onChange={(e) => patch({ installedOn: e.target.value, warrantyExpires: "" })}
          />
        </Field>
        <Field label="Purchased on" htmlFor={`buy-${draft.id ?? "new"}`}>
          <Input
            id={`buy-${draft.id ?? "new"}`}
            type="date"
            value={draft.purchasedOn}
            onChange={(e) => patch({ purchasedOn: e.target.value })}
          />
        </Field>
        <Field label="Years" htmlFor={`yrs-${draft.id ?? "new"}`}>
          <Input
            id={`yrs-${draft.id ?? "new"}`}
            type="number"
            min={0}
            inputMode="numeric"
            value={draft.warrantyYears}
            onChange={(e) => patch({ warrantyYears: e.target.value, warrantyExpires: "" })}
            placeholder="20"
          />
        </Field>
        <Field label="Expires" htmlFor={`exp-${draft.id ?? "new"}`}>
          <Input
            id={`exp-${draft.id ?? "new"}`}
            type="date"
            value={draft.warrantyExpires}
            onChange={(e) => patch({ warrantyExpires: e.target.value })}
          />
        </Field>
        <Field label="Installed by" htmlFor={`who-${draft.id ?? "new"}`}>
          <Input
            id={`who-${draft.id ?? "new"}`}
            value={draft.installerName}
            onChange={(e) => patch({ installerName: e.target.value })}
            placeholder={installerHint || "Shop name"}
          />
        </Field>
        <Field label="Claim phone" htmlFor={`tel-${draft.id ?? "new"}`}>
          <Input
            id={`tel-${draft.id ?? "new"}`}
            type="tel"
            value={draft.claimPhone}
            onChange={(e) => patch({ claimPhone: e.target.value })}
            placeholder="Manufacturer claim line"
          />
        </Field>
        <Field label="Register at" htmlFor={`url-${draft.id ?? "new"}`} className="sm:col-span-2">
          <Input
            id={`url-${draft.id ?? "new"}`}
            type="url"
            value={draft.registerUrl}
            onChange={(e) => patch({ registerUrl: e.target.value })}
            placeholder="https://"
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.registered}
          onChange={(e) => patch({ registered: e.target.checked })}
          className="size-4"
        />
        Registered with the manufacturer
      </label>

      <Field label="Comments" htmlFor={`notes-${draft.id ?? "new"}`}>
        <Textarea
          id={`notes-${draft.id ?? "new"}`}
          value={draft.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="Where it was installed, leftover material, or what the next claim should know."
          className="min-h-24 text-sm"
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : editing ? "Save card" : "Add materials"}
        </Button>
        {editing ? (
          <Button type="button" variant="ghost" className="text-destructive" disabled={busy} onClick={() => void remove()}>
            Remove
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function PhotoSlot({
  label,
  hint,
  icon,
  src,
  disabled,
  onSrc,
}: {
  label: string;
  hint: string;
  icon: ReactNode;
  src: string | null;
  disabled?: boolean;
  onSrc: (src: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      onSrc(await compressImage(file, 1200, 0.7));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that photo");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <label
      className={cn(
        "flex min-h-32 cursor-pointer flex-col overflow-hidden rounded-lg border border-dashed border-border bg-card/60 text-center hover:bg-muted",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      {src ? (
        <img src={src} alt={label} className="aspect-[4/3] w-full object-cover" />
      ) : (
        <span className="flex flex-1 flex-col items-center justify-center gap-1.5 px-3 py-4 text-sm text-muted-foreground">
          {icon}
          <span className="font-medium text-foreground">{busy ? "Reading…" : `Add ${label.toLowerCase()}`}</span>
          <span className="text-xs">{hint}</span>
          <Camera className="size-4" aria-hidden />
        </span>
      )}
      {src ? (
        <span className="px-2 py-1.5 text-xs font-medium">{busy ? "Replacing…" : label}</span>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={disabled || busy}
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
    </label>
  );
}
