import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BOOK_SLOTS,
  bookCsvTemplate,
  bookLabel,
  blockingPriceIssues,
  parseBookPhoto,
  parseMoney,
  priceIssues,
  slotsForOfferedWork,
  type BookSlot,
  type BookSlotId,
  type PriceBookItem,
} from "@/lib/housefile/book";
import { money } from "@/lib/housefile/format";
import { compressImage } from "@/lib/housefile/image";
import { WorkKitEditor } from "@/components/work-kit-editor";
import { shopCsvTemplate } from "@/lib/housefile/kits";
import { workTypesFor } from "@/lib/housefile/quote";
import {
  archivePriceBookItem,
  getDashboard,
  importPriceBookCsv,
  listPriceBook,
  upsertPriceBookItem,
} from "@/lib/housefile/server";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/book")({ component: PriceBookPage });

function PriceBookPage() {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ["price-book"], queryFn: () => listPriceBook() });
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Partial<PriceBookItem> | "new" | null>(null);
  const [csv, setCsv] = useState("");
  const offered = dash.data ? workTypesFor(dash.data.company.trades) : [];
  const offeredSlots = useMemo(() => slotsForOfferedWork(offered.map((w) => w.id)), [offered]);
  const offeredSlotIds = useMemo(() => new Set(offeredSlots.map((s) => s.id)), [offeredSlots]);
  const offeredTrades = useMemo(() => new Set(offeredSlots.map((s) => s.trade)), [offeredSlots]);

  const items = useMemo(() => {
    const list = (q.data?.items ?? []).filter((i) => i.active !== false);
    const scoped = dash.data
      ? list.filter((i) => offeredSlotIds.has(i.slot) || offeredTrades.has(i.trade))
      : [];
    const f = filter.trim().toLowerCase();
    if (!f) return scoped;
    return scoped.filter((i) => bookLabel(i).toLowerCase().includes(f) || i.slot.includes(f) || i.trade.includes(f));
  }, [q.data, filter, dash.data, offeredSlotIds, offeredTrades]);

  const grouped = useMemo(() => {
    const map = new Map<string, PriceBookItem[]>();
    for (const item of items) {
      const label = BOOK_SLOTS.find((s) => s.id === item.slot)?.label ?? item.slot;
      const list = map.get(label) ?? [];
      list.push(item);
      map.set(label, list);
    }
    return [...map.entries()];
  }, [items]);

  const health = useMemo(() => {
    let missing = 0;
    let errors = 0;
    let warns = 0;
    for (const item of items) {
      const issues = priceIssues(item);
      if (issues.some((i) => i.code === "missing_cost")) missing += 1;
      if (issues.some((i) => i.severity === "error")) errors += 1;
      else if (issues.some((i) => i.severity === "warn")) warns += 1;
    }
    return { missing, errors, warns };
  }, [items]);

  const save = useMutation({
    mutationFn: (row: {
      id?: string;
      trade: string;
      slot: string;
      manufacturer: string;
      product_name: string;
      sku: string;
      color: string;
      unit: string;
      cost: string;
      sell: string;
      warranty_years: string;
      warranty_terms: string;
      photo?: string | null;
    }) => upsertPriceBookItem({ data: row }),
    onSuccess: () => {
      toast.success("Saved to materials");
      setEditing(null);
      void q.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save"),
  });

  const archive = useMutation({
    mutationFn: (id: string) => archivePriceBookItem({ data: id }),
    onSuccess: () => {
      toast.success("Removed");
      void q.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not remove"),
  });

  const upload = useMutation({
    mutationFn: () => importPriceBookCsv({ data: csv }),
    onSuccess: (res) => {
      toast.success(
        res.kits
          ? `${res.count} catalog rows · ${res.kits} sub-categories`
          : `${res.count} rows in materials`,
      );
      setCsv("");
      void q.refetch();
      void queryClient.invalidateQueries({ queryKey: ["work-kits"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not import"),
  });

  const owner = q.data?.role === "owner";
  const editingId = editing && editing !== "new" ? editing.id : undefined;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Materials</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Quotes pick a work category, then a sub-category. Edit the lines here. Cost and sell stay
            in the shop — the homeowner sees the sell price.
          </p>
        </div>
        {owner && (
          <Button type="button" onClick={() => setEditing("new")}>
            Add a product
          </Button>
        )}
      </div>

      {owner && <WorkKitEditor owner={owner} />}

      <div>
        <h2 className="font-display text-xl font-medium">Products</h2>
        <p className="text-sm text-muted-foreground">
          What this shop buys and sells. Sub-category lines can pick from these slots.
        </p>
      </div>

      {(health.errors > 0 || health.missing > 0 || health.warns > 0) && (
        <p className="rounded-xl bg-card px-4 py-3 text-sm shadow-[var(--shadow-border)]">
          {health.errors > 0 && (
            <span className="text-destructive">
              {health.errors} {health.errors === 1 ? "product has a bad price" : "products have bad prices"}
              {". "}
            </span>
          )}
          {health.missing > 0 && (
            <span>
              {health.missing} {health.missing === 1 ? "product has no cost" : "products have no cost"}
              {". Sales will have to propose one."}
            </span>
          )}
          {health.missing === 0 && health.warns > 0 && (
            <span className="text-muted-foreground">
              {health.warns} {health.warns === 1 ? "price looks off" : "prices look off"} for this kind of product.
            </span>
          )}
        </p>
      )}

      <Input
        placeholder="Filter by product, slot, trade"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {editing === "new" && owner && items.length > 0 && (
        <BookForm
          key="new"
          initial={null}
          slots={offeredSlots}
          pending={save.isPending}
          onCancel={() => setEditing(null)}
          onSave={(row) => save.mutate(row)}
        />
      )}

      <div className="space-y-6">
        {grouped.map(([label, rows]) => (
          <section key={label} className="space-y-2">
            <h2 className="text-xs tracking-wide text-muted-foreground uppercase">{label}</h2>
            <ul className="divide-y divide-border rounded-xl bg-card shadow-[var(--shadow-border)]">
              {rows.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    editingId === item.id
                      ? "bg-muted/70 p-3 ring-1 ring-inset ring-ring"
                      : "flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                  )}
                >
                  {editingId === item.id && owner ? (
                    <BookForm
                      key={item.id}
                      initial={item}
                      slots={offeredSlots}
                      pending={save.isPending}
                      onCancel={() => setEditing(null)}
                      onSave={(row) => save.mutate(row)}
                    />
                  ) : (
                    <>
                      <div className="flex min-w-0 items-start gap-3">
                        {item.photo ? (
                          <img
                            src={item.photo}
                            alt=""
                            className="size-14 shrink-0 rounded-md object-cover shadow-[var(--shadow-border)]"
                          />
                        ) : (
                          <div className="grid size-14 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                            <Camera className="size-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium">{bookLabel(item)}</p>
                          <p className="text-sm text-muted-foreground">
                            Cost {item.cost == null ? "—" : money(item.cost)} / {item.unit}
                            {item.sell != null ? ` · sell ${money(item.sell)}` : ""}
                          </p>
                          {priceIssues(item).map((issue) => (
                            <p
                              key={issue.code}
                              className={
                                issue.severity === "error"
                                  ? "text-sm text-destructive"
                                  : "text-sm text-muted-foreground"
                              }
                            >
                              {issue.message}
                            </p>
                          ))}
                        </div>
                      </div>
                      {owner && (
                        <div className="flex flex-wrap gap-2">
                          <ProductPhotoButton
                            hasPhoto={Boolean(item.photo)}
                            disabled={save.isPending}
                            onPick={(photo) =>
                              save.mutate({
                                id: item.id,
                                trade: item.trade,
                                slot: item.slot,
                                manufacturer: item.manufacturer ?? "",
                                product_name: item.product_name,
                                sku: item.sku ?? "",
                                color: item.color ?? "",
                                unit: item.unit,
                                cost: item.cost == null ? "" : String(item.cost),
                                sell: item.sell == null ? "" : String(item.sell),
                                warranty_years: item.warranty_years == null ? "" : String(item.warranty_years),
                                warranty_terms: item.warranty_terms ?? "",
                                photo,
                              })
                            }
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setEditing(item)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => archive.mutate(item.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {items.length === 0 && (
          <div className="rounded-xl bg-card px-4 py-10 text-center shadow-[var(--shadow-border)]">
            <p className="font-display text-xl font-medium">No materials yet.</p>
            <p className="mx-auto mt-2 max-w-sm text-muted-foreground text-sm">
              Add a product with cost and sell, or paste a CSV from the yard.
            </p>
            {owner && editing !== "new" && (
              <Button type="button" className="mt-4" onClick={() => setEditing("new")}>
                Add a product
              </Button>
            )}
            {owner && editing === "new" && (
              <div className="mt-4 text-left">
                <BookForm
                  key="new"
                  initial={null}
                  slots={offeredSlots}
                  pending={save.isPending}
                  onCancel={() => setEditing(null)}
                  onSave={(row) => save.mutate(row)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {owner && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-medium">Upload a CSV</h2>
          <p className="text-sm text-muted-foreground">
            One file for the catalog: work category, sub-category, line items, and materials.
            Columns are work_category, sub_category, item, description, qty, unit, slot,
            manufacturer, product_name, sku, color, cost, sell, warranty_years, warranty_terms.
            A kit row needs sub_category and item. A product row needs slot and product_name. Both
            can live on the same row. The older trade / slot / product_name file still imports as
            materials only.
          </p>
          <p className="text-sm text-muted-foreground">
            <button type="button" className="underline" onClick={() => setCsv(shopCsvTemplate())}>
              Paste the Gutters catalog
            </button>
            {" · "}
            <button type="button" className="underline" onClick={() => setCsv(bookCsvTemplate())}>
              Short sample
            </button>
          </p>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={8}
            className="w-full rounded-md bg-card p-3 font-mono text-sm shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            placeholder="work_category,sub_category,item,description,qty,unit,slot,manufacturer,product_name,sku,color,cost,sell,warranty_years,warranty_terms"
          />
          <Button type="button" disabled={!csv.trim() || upload.isPending} onClick={() => upload.mutate()}>
            {upload.isPending ? "Importing…" : "Import catalog"}
          </Button>
        </section>
      )}

      <p className="text-sm text-muted-foreground">
        Dealer login (ABC, Beacon, SW) writes into this same list. Not wired yet.{" "}
        <Link to="/app/settings" className="underline">
          Team
        </Link>{" "}
        is under shop settings.
      </p>
    </div>
  );
}

function BookForm({
  initial,
  slots,
  pending,
  onCancel,
  onSave,
}: {
  initial: Partial<PriceBookItem> | null;
  slots: BookSlot[];
  pending: boolean;
  onCancel: () => void;
  onSave: (row: {
    id?: string;
    trade: string;
    slot: string;
    manufacturer: string;
    product_name: string;
    sku: string;
    color: string;
    unit: string;
    cost: string;
    sell: string;
    warranty_years: string;
    warranty_terms: string;
    photo?: string | null;
  }) => void;
}) {
  const slotChoices = slots.length ? slots : BOOK_SLOTS;
  const [slot, setSlot] = useState<BookSlotId>(
    (initial?.slot as BookSlotId) || slotChoices[0]?.id || "gutter",
  );
  const def = BOOK_SLOTS.find((s) => s.id === slot) ?? slotChoices[0]!;
  const [trade, setTrade] = useState(initial?.trade || def.trade);
  const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? "");
  const [product, setProduct] = useState(initial?.product_name ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [color, setColor] = useState(initial?.color ?? "");
  const [unit, setUnit] = useState(initial?.unit || def.unit);
  const [cost, setCost] = useState(initial?.cost != null ? String(initial.cost) : "");
  const [sell, setSell] = useState(initial?.sell != null ? String(initial.sell) : "");
  const [years, setYears] = useState(initial?.warranty_years != null ? String(initial.warranty_years) : "");
  const [terms, setTerms] = useState(initial?.warranty_terms ?? "");
  const [photo, setPhoto] = useState<string | null>(parseBookPhoto(initial?.photo));
  const photoInput = useRef<HTMLInputElement>(null);
  const [issues, setIssues] = useState(() =>
    priceIssues({
      slot: (initial?.slot as BookSlotId) || "shingle",
      cost: initial?.cost ?? null,
      sell: initial?.sell ?? null,
    }),
  );

  function check(nextCost = cost, nextSell = sell, nextSlot = slot) {
    const list = priceIssues({
      slot: nextSlot,
      cost: parseMoney(nextCost),
      sell: parseMoney(nextSell),
    });
    setIssues(list);
    return list;
  }

  const heading = initial?.id
    ? `Editing ${bookLabel(initial as PriceBookItem)}`
    : "New product";

  return (
    <form
      className="grid gap-3 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        check();
        if (blockingPriceIssues({ slot, cost: parseMoney(cost), sell: parseMoney(sell) }).length) {
          return;
        }
        onSave({
          id: initial?.id,
          trade,
          slot,
          manufacturer,
          product_name: product,
          sku,
          color,
          unit,
          cost,
          sell,
          warranty_years: years,
          warranty_terms: terms,
          photo,
        });
      }}
    >
      <p className="font-display text-lg font-medium sm:col-span-2">{heading}</p>
      <div className="flex items-center gap-3 sm:col-span-2">
        {photo ? (
          <div className="relative shrink-0">
            <img src={photo} alt="" className="size-16 rounded-md object-cover shadow-[var(--shadow-border)]" />
            <button
              type="button"
              className="absolute -top-1 -right-1 grid size-6 place-items-center rounded-full bg-background shadow-[var(--shadow-border)]"
              aria-label="Remove photo"
              onClick={() => setPhoto(null)}
            >
              <X className="size-3" />
            </button>
          </div>
        ) : (
          <div className="grid size-16 place-items-center rounded-md bg-muted text-muted-foreground">
            <Camera className="size-5" />
          </div>
        )}
        <Button type="button" size="sm" variant="outline" onClick={() => photoInput.current?.click()}>
          <Camera className="size-4" />
          {photo ? "Change photo" : "Add photo"}
        </Button>
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            void compressImage(file, 1000)
              .then(setPhoto)
              .catch((err) => toast.error(err instanceof Error ? err.message : "Could not read photo"));
          }}
        />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="slot">Slot</Label>
        <select
          id="slot"
          value={slot}
          onChange={(e) => {
            const next = e.target.value as BookSlotId;
            setSlot(next);
            const s = BOOK_SLOTS.find((x) => x.id === next)!;
            setTrade(s.trade);
            setUnit(s.unit);
            check(cost, sell, next);
          }}
          className="flex h-9 w-full rounded-md bg-background px-2.5 text-sm shadow-[var(--shadow-border)] outline-none"
        >
          {initial?.slot && !slotChoices.some((s) => s.id === initial.slot) ? (
            <option value={initial.slot}>
              {BOOK_SLOTS.find((s) => s.id === initial.slot)?.label ?? initial.slot}
            </option>
          ) : null}
          {slotChoices.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <Field label="Manufacturer" value={manufacturer} onChange={setManufacturer} />
      <Field label="Product" value={product} onChange={setProduct} />
      <Field label="SKU" value={sku} onChange={setSku} />
      <Field label="Color" value={color} onChange={setColor} />
      <Field label="Unit" value={unit} onChange={setUnit} />
      <Field
        label="Cost"
        value={cost}
        onChange={(v) => {
          setCost(v);
          check(v, sell, slot);
        }}
      />
      <Field
        label="Sell"
        value={sell}
        onChange={(v) => {
          setSell(v);
          check(cost, v, slot);
        }}
      />
      <Field label="Warranty years" value={years} onChange={setYears} />
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="terms">Warranty terms</Label>
        <Input id="terms" value={terms} onChange={(e) => setTerms(e.target.value)} />
      </div>
      {issues.length > 0 && (
        <ul className="space-y-1 sm:col-span-2 text-sm">
          {issues.map((issue) => (
            <li
              key={issue.code}
              className={issue.severity === "error" ? "text-destructive" : "text-muted-foreground"}
            >
              {issue.message}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button
          type="submit"
          disabled={
            pending ||
            !product.trim() ||
            blockingPriceIssues({ slot, cost: parseMoney(cost), sell: parseMoney(sell) }).length > 0
          }
        >
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ProductPhotoButton({
  hasPhoto,
  disabled,
  onPick,
}: {
  hasPhoto: boolean;
  disabled?: boolean;
  onPick: (photo: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <Camera className="size-4" />
        {hasPhoto ? "Change photo" : "Add photo"}
      </Button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          void compressImage(file, 1000)
            .then(onPick)
            .catch((err) => toast.error(err instanceof Error ? err.message : "Could not read photo"));
        }}
      />
    </>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
