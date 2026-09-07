import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CustomWorkDialog({
  open,
  onClose,
  onSave,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => void | Promise<void>;
  busy?: boolean;
}) {
  const [name, setName] = useState("");
  if (!open) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await onSave(trimmed);
    setName("");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" role="presentation" onClick={onClose}>
      <form
        className="w-full max-w-md space-y-4 rounded-xl bg-card p-5 shadow-[var(--shadow-border-hover)]"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => void submit(e)}
      >
        <div>
          <p className="font-display text-xl font-medium">Add a work category</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pools, fencing, irrigation — whatever you quote that is not already on the list.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="custom-work-name">Category name</Label>
          <Input
            id="custom-work-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pools"
            autoFocus
            required
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? "Saving…" : "Add category"}
          </Button>
        </div>
      </form>
    </div>
  );
}
