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
