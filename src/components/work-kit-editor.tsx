import { useMutation, useQuery } from "@tanstack/react-query";
import { Camera, X } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { money, num } from "@/lib/housefile/format";
import { compressImage } from "@/lib/housefile/image";
import {
  hasKitSeed,
  kitsToCsv,
  missingSeedKitNames,
  parseKitPhotos,
  workLabel,
  type WorkKit,
} from "@/lib/housefile/kits";
import { workTypesFor } from "@/lib/housefile/quote";
import { deleteWorkKit, getDashboard, listWorkKits, saveWorkKit, seedWorkKits } from "@/lib/housefile/server";

type DraftLine = {
  key: string;
  name: string;
  description: string;
  qty: string;
  unit: string;
  slot: string;
  price: string;
  photos: string[];
};

const emptyLine = (): DraftLine => ({
  key: crypto.randomUUID(),
  name: "",
  description: "",
  qty: "",
  unit: "ls",
  slot: "",
  price: "",
  photos: [],
});

export function WorkKitEditor({ owner }: { owner: boolean }) {
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const q = useQuery({ queryKey: ["work-kits"], queryFn: () => listWorkKits({ data: {} }) });
  const categories = dash.data ? workTypesFor(dash.data.company.trades) : [];
  const tradesReady = Boolean(dash.data);
  const offeredIds = useMemo(() => new Set(categories.map((c) => c.id)), [categories]);
  const kits = q.data?.kits ?? [];
  const grouped = useMemo(() => {
    const map = new Map<string, WorkKit[]>();
    for (const cat of categories) map.set(cat.id, []);
    for (const kit of kits) {
      if (!offeredIds.has(kit.work_id)) continue;
      const list = map.get(kit.work_id);
      if (!list) continue;
      list.push(kit);
    }
    return [...map.entries()];
  }, [kits, categories, offeredIds]);

  const [editing, setEditing] = useState<WorkKit | "new" | null>(null);

  const save = useMutation({
    mutationFn: (input: {
      id?: string;
      workId: string;
      name: string;
      items: DraftLine[];
    }) => saveWorkKit({ data: input }),
    onSuccess: () => {
      toast.success("Template saved");
      setEditing(null);
      void q.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteWorkKit({ data: id }),
    onSuccess: () => {
      toast.success("Template removed");
      void q.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not remove"),
  });
  const seed = useMutation({
    mutationFn: (workId: string) => seedWorkKits({ data: { workId } }),
    onSuccess: () => {
      toast.success("Starter templates loaded");
      void q.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not load starters"),
  });

  const selected = editing && editing !== "new" ? kits.find((kit) => kit.id === editing.id) ?? editing : null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium">Pre-Saved Templates</h2>
          <p className="text-sm text-muted-foreground">
            Pick a template to edit its lines. Quotes use these after the work category.
          </p>
        </div>
        {owner && (
          <div className="flex flex-wrap gap-2">
            {kits.length > 0 && (
              <Button type="button" variant="outline" onClick={() => downloadCsv(kitsToCsv(kits))}>
                Download CSV
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setEditing("new")}>
              Add a template
            </Button>
          </div>
        )}
      </div>

      {editing === "new" && owner && (
        <KitForm
          key="new"
          initial={null}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          pending={save.isPending}
          onCancel={() => setEditing(null)}
          onSave={(row) => save.mutate(row)}
        />
      )}

      {(q.isLoading || !tradesReady) && (
        <p className="text-sm text-muted-foreground">Loading templates…</p>
      )}
      {tradesReady && !q.isLoading && grouped.length === 0 && (
        <p className="rounded-xl bg-card px-4 py-6 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
          No work categories yet. Add services under Shop settings, then load starters here.
        </p>
      )}
      {tradesReady && grouped.map(([workId, rows]) => {
        const openHere = selected?.work_id === workId;
        return (
        <div key={workId} className="space-y-2">
          <h3 className="text-xs tracking-wide text-muted-foreground uppercase">{workLabel(workId)}</h3>
          {rows.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 text-sm shadow-[var(--shadow-border)]">
              <p className="text-muted-foreground">No templates yet.</p>
              {owner && hasKitSeed(workId) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={seed.isPending}
                  onClick={() => seed.mutate(workId)}
                >
                  {seed.isPending ? "Loading…" : "Load starters"}
                </Button>
              ) : owner ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setEditing("new")}>
                  Add a template
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="w-full max-w-[16rem] shrink-0 space-y-2">
                {owner && missingSeedKitNames(workId, rows.map((kit) => kit.name)).length > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-card px-3 py-2 text-sm shadow-[var(--shadow-border)]">
                    <p className="text-muted-foreground">
                      {missingSeedKitNames(workId, rows.map((kit) => kit.name)).join(", ")} can be loaded as a starter.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={seed.isPending}
                      onClick={() => seed.mutate(workId)}
                    >
                      {seed.isPending ? "Loading…" : "Load missing starters"}
                    </Button>
                  </div>
                ) : null}
                <ul className="grid grid-cols-2 gap-1.5">
                  {rows.map((kit) => {
                    const on = selected?.id === kit.id;
                    return (
                      <li key={kit.id}>
                        <button
                          type="button"
                          onClick={() => setEditing(on ? null : kit)}
                          className={
                            on
                              ? "flex aspect-square w-full items-center justify-center rounded-lg bg-primary px-1.5 text-center text-xs font-medium leading-tight text-primary-foreground"
                              : "flex aspect-square w-full items-center justify-center rounded-lg bg-card px-1.5 text-center text-xs font-medium leading-tight shadow-[var(--shadow-border)]"
                          }
                        >
                          <span className="line-clamp-3">{kit.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
              {openHere && owner && selected ? (
                <div className="min-w-0 flex-1">
                  <KitForm
                    key={selected.id}
                    initial={selected}
                    categories={categories.map((c) => ({ id: c.id, name: c.name }))}
                    pending={save.isPending}
                    onCancel={() => setEditing(null)}
                    onSave={(row) => save.mutate(row)}
                    onRemove={() => {
                      remove.mutate(selected.id);
                      setEditing(null);
                    }}
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>
        );
      })}
    </section>
  );
}

function KitForm({
  initial,
  categories,
  pending,
  onCancel,
  onSave,
  onRemove,
}: {
  initial: WorkKit | null;
  categories: { id: string; name: string }[];
  pending: boolean;
  onCancel: () => void;
  onSave: (row: { id?: string; workId: string; name: string; items: DraftLine[] }) => void;
  onRemove?: () => void;
}) {
  const [workId, setWorkId] = useState(initial?.work_id || categories[0]?.id || "gutters");
  const workOptions =
    initial?.work_id && !categories.some((c) => c.id === initial.work_id)
      ? [{ id: initial.work_id, name: workLabel(initial.work_id) }, ...categories]
      : categories;
  const [name, setName] = useState(initial?.name ?? "");
  const [items, setItems] = useState<DraftLine[]>(
    initial?.items.length
      ? initial.items.map((i) => ({
          key: i.id || crypto.randomUUID(),
          name: i.name,
          description: i.description ?? "",
          qty: i.qty ?? "",
          unit: i.unit || "ls",
          slot: i.slot ?? "",
          price: i.price != null ? String(i.price) : "",
          photos: parseKitPhotos(i.photos),
        }))
      : [emptyLine()],
  );

  function setLine(i: number, patch: Partial<DraftLine>) {
    setItems((cur) => cur.map((line, idx) => (idx === i ? { ...line, ...patch } : line)));
  }

  function removeLine(i: number) {
    setItems((cur) => (cur.length <= 1 ? [emptyLine()] : cur.filter((_, idx) => idx !== i)));
  }

  return (
    <form
      className="space-y-3 rounded-xl bg-card p-3 shadow-[var(--shadow-border)]"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ id: initial?.id, workId, name, items: items.filter((l) => l.name.trim()) });
      }}
    >
      <p className="font-display text-lg font-medium">{initial ? `Editing ${initial.name}` : "New template"}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-0.5">
          <Label htmlFor="kit-work">Work category</Label>
          <select
            id="kit-work"
            value={workId}
            onChange={(e) => setWorkId(e.target.value)}
            className="flex h-9 w-full rounded-md bg-background px-2.5 text-sm shadow-[var(--shadow-border)] outline-none"
          >
            {workOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-0.5">
          <Label htmlFor="kit-name">Template</Label>
          <Input
            id="kit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Gutters Plus Drainage"
          />
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-sm font-medium">Line items</p>
        {items.map((line, i) => (
          <KitLineRow
            key={line.key}
            line={line}
            onChange={(patch) => setLine(i, patch)}
            onRemove={() => removeLine(i)}
          />
        ))}
        <Button type="button" variant="outline" onClick={() => setItems((cur) => [...cur, emptyLine()])}>
          Add a line
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        {onRemove ? (
          <Button type="button" variant="ghost" onClick={onRemove}>
            Remove
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function KitLineRow({
  line,
  onChange,
  onRemove,
}: {
  line: DraftLine;
  onChange: (patch: Partial<DraftLine>) => void;
  onRemove: () => void;
}) {
  const photoInput = useRef<HTMLInputElement>(null);

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    try {
      const added: string[] = [];
      for (const file of Array.from(files).slice(0, 8)) {
        added.push(await compressImage(file, 1000));
      }
      onChange({ photos: [...line.photos, ...added].slice(0, 8) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read photo");
    }
  }

  return (
    <div className="space-y-2 rounded-lg bg-background p-3 shadow-[var(--shadow-border)]">
      <div className="flex items-end gap-1">
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-12">
          <div className="space-y-0.5 sm:col-span-6">
            <Label>Line item</Label>
            <Input value={line.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Line item" />
          </div>
          <div className="space-y-0.5 sm:col-span-2">
            <Label>Quantity</Label>
            <Input
              value={line.qty}
              onChange={(e) => onChange({ qty: e.target.value })}
              placeholder="Quantity"
              inputMode="decimal"
            />
          </div>
          <div className="space-y-0.5 sm:col-span-2">
            <Label>Cost</Label>
            <Input
              value={line.price}
              onChange={(e) => onChange({ price: e.target.value })}
              placeholder="Cost"
              inputMode="decimal"
            />
          </div>
          <div className="space-y-0.5 sm:col-span-2">
            <Label>Amount</Label>
            <p className="flex h-7 items-center tabular-nums">{money(kitLineTotal(line.qty, line.price))}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-7"
            aria-label="Add image"
            title="Add image"
            onClick={() => photoInput.current?.click()}
          >
            <Camera className="size-4" />
          </Button>
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              void addPhotos(e.target.files);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label="Remove line"
            title="Remove line"
            onClick={onRemove}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
      <div className="space-y-0.5">
        <Label>Description</Label>
        <AutoGrowTextarea
          value={line.description}
          onChange={(description) => onChange({ description })}
          placeholder="Description"
        />
      </div>
      {line.photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {line.photos.map((src, i) => (
            <div key={`${src.slice(0, 24)}-${i}`} className="relative overflow-hidden rounded-lg bg-muted">
              <img src={src} alt="" className="aspect-square w-full object-cover" />
              <button
                type="button"
                className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-background/90 text-xs"
                aria-label="Remove photo"
                onClick={() => onChange({ photos: line.photos.filter((_, idx) => idx !== i) })}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(el.scrollHeight, 64)}px`;
  }, [value]);
  return (
    <Textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      className="min-h-16 resize-none overflow-hidden"
    />
  );
}

function kitLineTotal(qty: string | null | undefined, price: string | number | null | undefined) {
  return Math.round(num(qty) * num(price) * 100) / 100;
}

function downloadCsv(text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "shop-catalog.csv";
  a.click();
  URL.revokeObjectURL(url);
}
