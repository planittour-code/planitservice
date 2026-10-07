import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MaintenanceBadge } from "@/components/status-badge";
import {
  MAINTENANCE_SYSTEMS,
  cadenceLabel,
  taskStatus,
  todayIso,
  type Cadence,
} from "@/lib/housefile/maintain";
import { shortDate } from "@/lib/housefile/format";
import type { MaintenanceTask } from "@/lib/housefile/types";

const CADENCE_OPTIONS: { value: Cadence; label: string }[] = [
  { value: "monthly", label: "Every month" },
  { value: "quarterly", label: "Every 3 months" },
  { value: "semiannual", label: "Twice a year" },
  { value: "annual", label: "Once a year" },
];

export function MaintenanceChecklist({
  tasks,
  donePending,
  removePending,
  addPending,
  onDone,
  onRemove,
  onAdd,
  extra,
}: {
  tasks: MaintenanceTask[];
  donePending?: boolean;
  removePending?: boolean;
  addPending?: boolean;
  onDone: (taskId: string) => void;
  onRemove: (taskId: string) => void;
  onAdd: (input: { title: string; system: string; cadence: Cadence }) => void;
  extra?: (task: MaintenanceTask) => ReactNode;
}) {
  const [title, setTitle] = useState("");
  const [system, setSystem] = useState("Custom");
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const groups = groupTasks(tasks);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.system} className="space-y-2">
          <h4 className="font-display text-sm font-bold tracking-tight">{group.system}</h4>
          <ul className="divide-y divide-border rounded-md bg-background shadow-[var(--shadow-border)]">
            {group.tasks.map((t) => (
              <li key={t.id} className="space-y-3 px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">{t.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {cadenceLabel(t.cadence)} · due {shortDate(t.due_on)}
                      {t.scheduled_on ? ` · scheduled ${shortDate(t.scheduled_on)}` : ""}
                    </p>
                    {t.scheduled_note ? (
                      <p className="text-sm text-muted-foreground">{t.scheduled_note}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <MaintenanceBadge status={taskStatus(t, todayIso())} />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={donePending}
                      onClick={() => onDone(t.id)}
                    >
                      Mark done
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={removePending}
                      onClick={() => onRemove(t.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                {extra?.(t)}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <form
        className="space-y-3 rounded-md bg-muted/40 p-3 shadow-[var(--shadow-border)]"
        onSubmit={(e) => {
          e.preventDefault();
          const nextTitle = title.trim();
          if (!nextTitle) return;
          onAdd({ title: nextTitle, system, cadence });
          setTitle("");
          setSystem("Custom");
          setCadence("monthly");
        }}
      >
        <div>
          <h4 className="font-display text-sm font-bold tracking-tight">Add a checklist item</h4>
          <p className="text-sm text-muted-foreground">
            Use Custom for your own list, or pick Lawn/Grounds, Pool, House, and the rest. Remove
            anything that does not apply to this house.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="maintenance-title">Item</Label>
            <Input
              id="maintenance-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Clean the dryer vent"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="maintenance-system">Category</Label>
            <select
              id="maintenance-system"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              value={system}
              onChange={(e) => setSystem(e.target.value)}
            >
              {MAINTENANCE_SYSTEMS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="maintenance-cadence">How often</Label>
            <select
              id="maintenance-cadence"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              value={cadence}
              onChange={(e) => setCadence(e.target.value as Cadence)}
            >
              {CADENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button type="submit" size="sm" disabled={addPending || !title.trim()}>
          {addPending ? "Adding…" : "Add to checklist"}
        </Button>
      </form>
    </div>
  );
}

export function ScheduleTask({
  task,
  pending,
  onSave,
}: {
  task: MaintenanceTask;
  pending: boolean;
  onSave: (scheduledOn: string | null, scheduledNote?: string) => void;
}) {
  const [date, setDate] = useState(task.scheduled_on ?? "");
  const [note, setNote] = useState(task.scheduled_note ?? "");

  useEffect(() => {
    setDate(task.scheduled_on ?? "");
    setNote(task.scheduled_note ?? "");
  }, [task.scheduled_on, task.scheduled_note]);

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(date || null, note);
      }}
    >
      <div className="space-y-1">
        <Label htmlFor={`sched-${task.id}`}>Scheduled date</Label>
        <Input
          id={`sched-${task.id}`}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full sm:w-44"
        />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <Label htmlFor={`note-${task.id}`}>Note (optional)</Label>
        <Input
          id={`note-${task.id}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Vendor, window, or who agreed"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending || !date}>
          {task.scheduled_on ? "Update" : "Schedule"}
        </Button>
        {task.scheduled_on ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => onSave(null)}
          >
            Clear
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function groupTasks(tasks: MaintenanceTask[]) {
  const order = [...MAINTENANCE_SYSTEMS];
  const buckets = new Map<string, MaintenanceTask[]>();
  for (const task of tasks) {
    const key = task.system_name?.trim() || "Custom";
    const list = buckets.get(key) ?? [];
    list.push(task);
    buckets.set(key, list);
  }
  const named = order
    .filter((name) => buckets.has(name))
    .map((name) => ({ system: name, tasks: buckets.get(name)! }));
  const extras = [...buckets.keys()]
    .filter((name) => !order.includes(name as (typeof MAINTENANCE_SYSTEMS)[number]))
    .sort()
    .map((name) => ({ system: name, tasks: buckets.get(name)! }));
  return [...named, ...extras];
}
