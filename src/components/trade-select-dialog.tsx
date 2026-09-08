import { useEffect, useState } from "react";
import { CustomWorkDialog } from "@/components/custom-work-dialog";
import { Button } from "@/components/ui/button";
import { customWorkId, isCustomWorkId, workFromId, WORK_TYPES } from "@/lib/housefile/quote";
import { cn } from "@/lib/utils";

export function TradeSelectDialog({
  open,
  selected,
  onClose,
  onSave,
  busy = false,
}: {
  open: boolean;
  selected: string[];
  onClose: () => void;
  onSave: (ids: string[]) => void;
  busy?: boolean;
}) {
  const [ids, setIds] = useState(selected);
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    if (open) setIds(selected);
  }, [open]);
  if (!open) return null;

  function toggle(id: string) {
    setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  const options = [
    ...WORK_TYPES,
    ...ids
      .map((id) => workFromId(id))
      .filter((w): w is NonNullable<typeof w> => Boolean(w && isCustomWorkId(w.id))),
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" role="presentation" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-xl bg-card p-5 shadow-[var(--shadow-border-hover)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="font-display text-xl font-medium">What do you quote?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            These are the trades this shop offers. They show above the shop name and on Start a Quote.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {options.map((w) => {
            const on = ids.includes(w.id);
            return (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => toggle(w.id)}
                  className={cn(
                    "h-full w-full rounded-xl border border-border p-4 text-left",
                    on ? "bg-primary text-primary-foreground" : "bg-background",
                  )}
                >
                  <p className="font-display text-lg font-medium">{w.name}</p>
                  <p className={cn("mt-1 text-sm", on ? "opacity-80" : "text-muted-foreground")}>{w.blurb}</p>
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="h-full w-full rounded-xl border border-border bg-background p-4 text-left"
            >
              <p className="font-display text-lg font-medium">+Add</p>
              <p className="mt-1 text-sm text-muted-foreground">Pools, fencing, or anything you quote.</p>
            </button>
          </li>
        </ul>
        <CustomWorkDialog
          open={adding}
          onClose={() => setAdding(false)}
          onSave={(label) => {
            const id = customWorkId(label);
            setIds((cur) => (cur.includes(id) ? cur : [...cur, id]));
            setAdding(false);
          }}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={busy || ids.length === 0} onClick={() => onSave(ids)}>
            {busy ? "Saving…" : "Save trades"}
          </Button>
        </div>
      </div>
    </div>
  );
}
