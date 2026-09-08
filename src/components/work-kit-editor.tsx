import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BOOK_SLOTS } from "@/lib/housefile/book";
import { hasKitSeed, kitsToCsv, workLabel, type WorkKit } from "@/lib/housefile/kits";
import { workTypesFor } from "@/lib/housefile/quote";
import { deleteWorkKit, getDashboard, listWorkKits, saveWorkKit, seedWorkKits } from "@/lib/housefile/server";

type DraftLine = { name: string; description: string; qty: string; unit: string; slot: string };

const emptyLine = (): DraftLine => ({ name: "", description: "", qty: "", unit: "ls", slot: "" });

export function WorkKitEditor({ owner }: { owner: boolean }) {
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const q = useQuery({ queryKey: ["work-kits"], queryFn: () => listWorkKits({ data: {} }) });
  const categories = dash.data ? workTypesFor(dash.data.company.trades) : [];
  const kits = q.data?.kits ?? [];
  const grouped = useMemo(() => {
    const map = new Map<string, WorkKit[]>();
    for (const cat of categories) map.set(cat.id, []);
    for (const kit of kits) {
      const list = map.get(kit.work_id) ?? [];
      list.push(kit);
      map.set(kit.work_id, list);
    }
    return [...map.entries()];
  }, [kits, categories]);

  const [editing, setEditing] = useState<WorkKit | "new" | null>(null);

  const save = useMutation({
    mutationFn: (input: {
      id?: string;
      workId: string;
      name: string;
      items: DraftLine[];
    }) => saveWorkKit({ data: input }),
    onSuccess: () => {
      toast.success("Sub-category saved");
      setEditing(null);
      void q.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteWorkKit({ data: id }),
    onSuccess: () => {
      toast.success("Sub-category removed");
      void q.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not remove"),
  });
  const seed = useMutation({
    mutationFn: (workId: string) => seedWorkKits({ data: { workId } }),
    onSuccess: () => {
      toast.success("Starter sub-categories loaded");
      void q.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not load starters"),
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-medium">Sub-categories</h2>
          <p className="text-sm text-muted-foreground">
            Quotes pick a work category, then a sub-category. Starters load for each trade you
            offer — edit the lines any time.
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
              Add a sub-category
            </Button>
          </div>
        )}
      </div>

      {editing && owner && (
        <KitForm
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          pending={save.isPending}
          onCancel={() => setEditing(null)}
          onSave={(row) => save.mutate(row)}
        />
      )}

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading sub-categories…</p>}
      {!q.isLoading && grouped.length === 0 && (
        <p className="rounded-xl bg-card px-4 py-6 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
          No work categories yet. Add services under Shop settings, then load starters here.
        </p>
      )}
      {grouped.map(([workId, rows]) => (
        <div key={workId} className="space-y-2">
          <h3 className="text-xs tracking-wide text-muted-foreground uppercase">{workLabel(workId)}</h3>
          {rows.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card px-4 py-4 text-sm shadow-[var(--shadow-border)]">
              <p className="text-muted-foreground">No sub-categories yet.</p>
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
                  Add a sub-category
                </Button>
              ) : null}
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-xl bg-card shadow-[var(--shadow-border)]">
              {rows.map((kit) => (
                <li key={kit.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{kit.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {kit.items.length} {kit.items.length === 1 ? "line item" : "line items"}
                    </p>
                  </div>
                  {owner && (
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(kit)}>
                        Edit
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => remove.mutate(kit.id)}>
                        Remove
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

function KitForm({
  initial,
  categories,
  pending,
  onCancel,
  onSave,
}: {
  initial: WorkKit | null;
  categories: { id: string; name: string }[];
  pending: boolean;
  onCancel: () => void;
  onSave: (row: { id?: string; workId: string; name: string; items: DraftLine[] }) => void;
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
          name: i.name,
          description: i.description ?? "",
          qty: i.qty ?? "",
          unit: i.unit || "ls",
          slot: i.slot ?? "",
        }))
      : [emptyLine(), emptyLine(), emptyLine()],
  );

  function setLine(i: number, patch: Partial<DraftLine>) {
    setItems((cur) => cur.map((line, idx) => (idx === i ? { ...line, ...patch } : line)));
  }

  return (
    <form
      className="space-y-4 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ id: initial?.id, workId, name, items: items.filter((l) => l.name.trim()) });
      }}
    >
      <p className="font-display text-lg font-medium">{initial ? `Editing ${initial.name}` : "New sub-category"}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="kit-work">Work category</Label>
          <select
            id="kit-work"
            value={workId}
            onChange={(e) => setWorkId(e.target.value)}
            className="flex h-11 w-full rounded-md bg-background px-3 text-sm shadow-[var(--shadow-border)] outline-none"
          >
            {workOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="kit-name">Sub-category</Label>
          <Input id="kit-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="5-Inch New Install" />
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-sm font-medium">Line items</p>
        {items.map((line, i) => (
          <div key={i} className="grid gap-2 rounded-lg bg-background p-3 shadow-[var(--shadow-border)] sm:grid-cols-12">
            <div className="sm:col-span-3">
              <Label className="sr-only">Item</Label>
              <Input value={line.name} onChange={(e) => setLine(i, { name: e.target.value })} placeholder="Line item" />
            </div>
            <div className="sm:col-span-3">
              <Input
                value={line.description}
                onChange={(e) => setLine(i, { description: e.target.value })}
                placeholder="Description"
              />
            </div>
            <Input
              className="sm:col-span-2"
              value={line.qty}
              onChange={(e) => setLine(i, { qty: e.target.value })}
              placeholder="Qty"
            />
            <Input
              className="sm:col-span-2"
              value={line.unit}
              onChange={(e) => setLine(i, { unit: e.target.value })}
              placeholder="Unit"
            />
            <select
              value={line.slot}
              onChange={(e) => setLine(i, { slot: e.target.value })}
              className="flex h-11 w-full rounded-md bg-card px-3 text-sm shadow-[var(--shadow-border)] outline-none sm:col-span-2"
            >
              <option value="">No product slot</option>
              {BOOK_SLOTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => setItems((cur) => [...cur, emptyLine()])}>
          Add a line
        </Button>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
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
