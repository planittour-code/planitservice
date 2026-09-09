export type Cadence = "monthly" | "quarterly" | "semiannual" | "annual";

export type MaintenanceTemplate = {
  title: string;
  system: string;
  cadence: Cadence;
};

export const MAINTENANCE_LIBRARY: MaintenanceTemplate[] = [
  { title: "Replace HVAC filter", system: "Climate", cadence: "quarterly" },
  { title: "Test smoke and CO alarms", system: "Safety", cadence: "monthly" },
  { title: "Clean gutters and downspouts", system: "Exterior", cadence: "semiannual" },
  { title: "Flush the water heater", system: "Plumbing", cadence: "annual" },
  { title: "Service HVAC (tune-up)", system: "Climate", cadence: "annual" },
  { title: "Inspect roof and flashing", system: "Roof", cadence: "annual" },
  { title: "Reverse ceiling fans for the season", system: "Electrical", cadence: "semiannual" },
  { title: "Exercise shutoff valves", system: "Plumbing", cadence: "annual" },
  { title: "Check caulk and exterior paint", system: "Exterior", cadence: "annual" },
  { title: "Test sump pump / basement drain", system: "Plumbing", cadence: "annual" },
];

export function nextDue(cadence: Cadence, from = new Date()) {
  const d = new Date(from);
  if (cadence === "monthly") d.setMonth(d.getMonth() + 1);
  else if (cadence === "quarterly") d.setMonth(d.getMonth() + 3);
  else if (cadence === "semiannual") d.setMonth(d.getMonth() + 6);
  else d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export function cadenceLabel(c: string) {
  if (c === "monthly") return "Every month";
  if (c === "quarterly") return "Every 3 months";
  if (c === "semiannual") return "Twice a year";
  return "Once a year";
}

export type MaintenanceStatus = "scheduled" | "overdue" | "dueSoon" | "current";

const DUE_SOON_DAYS = 14;
const UPCOMING_DAYS = 60;

export function todayIso(from = new Date()) {
  const y = from.getFullYear();
  const m = String(from.getMonth() + 1).padStart(2, "0");
  const d = String(from.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + days);
  return todayIso(d);
}

export function parseIsoDate(value: string | null | undefined) {
  const s = value?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return s;
}

export function taskStatus(
  task: { due_on: string; scheduled_on?: string | null; completed_at?: string | null },
  today = todayIso(),
): MaintenanceStatus {
  if (task.scheduled_on) return "scheduled";
  if (task.due_on < today) return "overdue";
  if (task.due_on <= addDaysIso(today, DUE_SOON_DAYS)) return "dueSoon";
  return "current";
}

export function houseMaintenanceStatus(
  tasks: { due_on: string; scheduled_on?: string | null; completed_at?: string | null }[],
  today = todayIso(),
): MaintenanceStatus {
  const open = tasks.filter((t) => !t.completed_at);
  if (open.some((t) => taskStatus(t, today) === "overdue")) return "overdue";
  if (open.some((t) => taskStatus(t, today) === "dueSoon")) return "dueSoon";
  if (open.some((t) => taskStatus(t, today) === "scheduled")) return "scheduled";
  return "current";
}

export function maintenanceStatusLabel(status: MaintenanceStatus) {
  if (status === "scheduled") return "Scheduled";
  if (status === "overdue") return "Overdue";
  if (status === "dueSoon") return "Due soon";
  return "Current";
}

export function maintenanceRank(status: MaintenanceStatus) {
  if (status === "overdue") return 0;
  if (status === "dueSoon") return 1;
  if (status === "scheduled") return 2;
  return 3;
}

export function relevantTaskDate(task: { due_on: string; scheduled_on?: string | null }) {
  return task.scheduled_on || task.due_on;
}

export function isUpcomingTask(
  task: { due_on: string; scheduled_on?: string | null; completed_at?: string | null },
  today = todayIso(),
) {
  if (task.completed_at) return false;
  const horizon = addDaysIso(today, UPCOMING_DAYS);
  if (task.due_on < today) return true;
  if (task.due_on <= horizon) return true;
  if (task.scheduled_on && task.scheduled_on <= horizon) return true;
  return false;
}

export function nextOpenTask<T extends { id: string; title: string; due_on: string; scheduled_on?: string | null; completed_at?: string | null }>(
  tasks: T[],
  today = todayIso(),
) {
  const open = tasks.filter((t) => !t.completed_at);
  if (open.length === 0) return null;
  open.sort((a, b) => {
    const sa = taskStatus(a, today);
    const sb = taskStatus(b, today);
    const rank = maintenanceRank(sa) - maintenanceRank(sb);
    if (rank !== 0) return rank;
    return relevantTaskDate(a).localeCompare(relevantTaskDate(b));
  });
  const t = open[0]!;
  return {
    id: t.id,
    title: t.title,
    due_on: t.due_on,
    scheduled_on: t.scheduled_on ?? null,
    status: taskStatus(t, today),
  };
}
