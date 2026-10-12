import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MonthFolder } from "@/components/month-folder";
import { MaintenanceBadge } from "@/components/status-badge";
import {
  MAINTENANCE_SYSTEMS,
  cadenceLabel,
  isHvacTask,
  maintenanceRecordMonths,
  scheduleCadence,
  taskStatus,
  todayIso,
  type Cadence,
} from "@/lib/housefile/maintain";
import { shortDate } from "@/lib/housefile/format";
import type { MaintenanceTask } from "@/lib/housefile/types";

const CADENCE_CHECKS: { value: Cadence; label: string }[] = [
  { value: "daily", label: "Day" },
  { value: "weekly", label: "Week" },
  { value: "monthly", label: "Month" },
];

export type MaintenanceAddInput = {
  title: string;
  system: string;
  cadence: Cadence;
  notes?: string;
  alertOn?: boolean;
};

export type MaintenanceUpdateInput = {
  taskId: string;
  notes?: string;
  cadence?: Cadence;
  alertOn?: boolean;
};

export function MaintenanceChecklist({
  tasks,
  completedTasks,
  clientSince,
  donePending,
  removePending,
  addPending,
  updatePending,
  onDone,
  onRemove,
  onAdd,
  onUpdate,
  extra,
}: {
  tasks: MaintenanceTask[];
  completedTasks?: MaintenanceTask[];
  clientSince?: string | Date | null;
  donePending?: boolean;
  removePending?: boolean;
  addPending?: boolean;
  updatePending?: boolean;
  onDone: (taskId: string) => void;
  onRemove: (taskId: string) => void;
  onAdd: (input: MaintenanceAddInput) => void;
  onUpdate?: (input: MaintenanceUpdateInput) => void;
  extra?: (task: MaintenanceTask) => ReactNode;
}) {
  const [title, setTitle] = useState("");
  const [system, setSystem] = useState("Custom");
  const [cadence, setCadence] = useState<Cadence>("annual");
  const [notes, setNotes] = useState("");
  const [alertOn, setAlertOn] = useState(true);
  const open = tasks.filter((task) => !task.completed_at);
  const history = completedTasks ?? tasks.filter((task) => task.completed_at);
  const groups = groupTasks(open);
  const months = maintenanceRecordMonths(history, clientSince);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.system} className="space-y-2">
          <h4 className="font-display text-sm font-bold tracking-tight">{group.system}</h4>
          <ul className="divide-y divide-border rounded-md bg-background shadow-[var(--shadow-border)]">
            {group.tasks.map((t) => (
              <li key={t.id} className="space-y-3 px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{t.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {cadenceLabel(scheduleCadence(t.cadence))} · due {shortDate(t.due_on)}
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
                <TaskScheduleFields
                  task={t}
                  disabled={updatePending}
                  onUpdate={onUpdate}
                />
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
          onAdd({
            title: nextTitle,
            system,
            cadence,
            notes: notes.trim() || undefined,
            alertOn,
          });
          setTitle("");
          setSystem("Custom");
          setCadence("annual");
          setNotes("");
          setAlertOn(true);
        }}
      >
        <div>
          <h4 className="font-display text-sm font-bold tracking-tight">Add to the schedule</h4>
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
              placeholder="Replace HVAC filter"
              required
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="maintenance-notes">Notes for instructions</Label>
            <Input
              id="maintenance-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                isHvacTask({ title, system }) ? "HVAC filter size" : undefined
              }
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
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">How often</legend>
            <CadenceChecks value={cadence} onChange={setCadence} />
          </fieldset>
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">Alert</legend>
            <AlertChecks value={alertOn} onChange={setAlertOn} />
          </fieldset>
        </div>
        <Button type="submit" size="sm" disabled={addPending || !title.trim()}>
          {addPending ? "Adding…" : "Add to schedule"}
        </Button>
      </form>

      {months.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h4 className="font-display text-sm font-bold tracking-tight">Service record</h4>
            <p className="text-sm text-muted-foreground">
              One folder for each month this house has been a client. Marked-done work files here as the
              maintenance record.
            </p>
          </div>
          <ul className="space-y-4">
            {months.map((month) => (
              <li key={month.key}>
                <MonthFolder
                  label={month.label}
                  count={month.tasks.length}
                  countLabel={`${month.tasks.length} ${month.tasks.length === 1 ? "record" : "records"}`}
                >
                  {month.tasks.length ? (
                    <ul className="divide-y divide-border rounded-md bg-background">
                      {month.tasks.map((task) => (
                        <li key={task.id} className="px-4 py-3">
                          <p className="font-medium">{task.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {task.system_name}
                            {task.completed_at ? ` · ${shortDate(task.completed_at)}` : ""}
                          </p>
                          {task.notes ? (
                            <p className="text-sm text-muted-foreground">{task.notes}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-3 py-4 text-sm text-muted-foreground">
                      No maintenance recorded this month.
                    </p>
                  )}
                </MonthFolder>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function TaskScheduleFields({
  task,
  disabled,
  onUpdate,
}: {
  task: MaintenanceTask;
  disabled?: boolean;
  onUpdate?: (input: MaintenanceUpdateInput) => void;
}) {
  const [notes, setNotes] = useState(task.notes ?? "");

  useEffect(() => {
    setNotes(task.notes ?? "");
  }, [task.id, task.notes]);

  const saveNotes = () => {
    if (!onUpdate) return;
    const next = notes.trim();
    const prev = (task.notes ?? "").trim();
    if (next === prev) return;
    onUpdate({ taskId: task.id, notes: next });
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label htmlFor={`notes-${task.id}`}>Notes for instructions</Label>
        <Input
          id={`notes-${task.id}`}
          value={notes}
          disabled={disabled || !onUpdate}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder={isHvacTask(task) ? "HVAC filter size" : undefined}
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">How often</legend>
          <CadenceChecks
            name={`cadence-${task.id}`}
            value={scheduleCadence(task.cadence)}
            disabled={disabled || !onUpdate}
            onChange={(cadence) =>
              onUpdate?.({ taskId: task.id, cadence, notes: notes.trim() })
            }
          />
        </fieldset>
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">Alert</legend>
          <AlertChecks
            name={`alert-${task.id}`}
            value={task.alert_on !== false}
            disabled={disabled || !onUpdate}
            onChange={(next) =>
              onUpdate?.({ taskId: task.id, alertOn: next, notes: notes.trim() })
            }
          />
        </fieldset>
      </div>
    </div>
  );
}

function CadenceChecks({
  name,
  value,
  disabled,
  onChange,
}: {
  name?: string;
  value: string;
  disabled?: boolean;
  onChange: (cadence: Cadence) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {CADENCE_CHECKS.map((opt) => (
        <CheckOption
          key={opt.value}
          name={name}
          label={opt.label}
          checked={value === opt.value}
          disabled={disabled}
          onPick={() => {
            onChange(value === opt.value ? "annual" : opt.value);
          }}
        />
      ))}
    </div>
  );
}

function AlertChecks({
  name,
  value,
  disabled,
  onChange,
}: {
  name?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (alertOn: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <CheckOption
        name={name}
        label="On"
        checked={value}
        disabled={disabled}
        onPick={() => {
          if (!value) onChange(true);
        }}
      />
      <CheckOption
        name={name}
        label="Off"
        checked={!value}
        disabled={disabled}
        onPick={() => {
          if (value) onChange(false);
        }}
      />
    </div>
  );
}

function CheckOption({
  name,
  label,
  checked,
  disabled,
  onPick,
}: {
  name?: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onPick: () => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 rounded-md bg-card px-3 text-sm shadow-[var(--shadow-border)]">
      <input
        type="checkbox"
        className="size-4 shrink-0"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onPick}
      />
      {label}
    </label>
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
