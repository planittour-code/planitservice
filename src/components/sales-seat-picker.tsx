import { Label } from "@/components/ui/label";
import type { CompanyMember } from "@/lib/housefile/types";

function seatLabel(seat: CompanyMember) {
  const email = seat.email.trim().toLowerCase();
  const name = (seat.name || "").trim();
  if (name && name.toLowerCase() !== email) return `${name} · ${email}`;
  return email;
}

export function SalesSeatPicker({
  members,
  selected,
  onChange,
}: {
  members: CompanyMember[];
  selected: string[];
  onChange: (emails: string[]) => void;
}) {
  const seats = members.filter((m) => m.email.trim());
  if (seats.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add sales seats in Shop settings to put a salesperson on this estimate.
      </p>
    );
  }

  const first = selected[0] ?? "";
  const second = selected[1] ?? "";

  function setSlot(index: 0 | 1, value: string) {
    const next = [first, second];
    next[index] = value;
    const unique: string[] = [];
    for (const email of next) {
      const key = email.trim().toLowerCase();
      if (!key || unique.includes(key)) continue;
      unique.push(key);
    }
    onChange(unique.slice(0, 2));
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor="sales-seat-1">Salesperson</Label>
        <select
          id="sales-seat-1"
          value={first}
          onChange={(e) => setSlot(0, e.target.value)}
          className="flex h-10 w-full rounded-sm bg-card px-3 text-sm shadow-[var(--shadow-border)] outline-none"
        >
          <option value="">Select</option>
          {seats.map((seat) => {
            const email = seat.email.trim().toLowerCase();
            return (
              <option key={seat.id || email} value={email} disabled={email === second}>
                {seatLabel(seat)}
              </option>
            );
          })}
        </select>
      </div>
      {seats.length > 1 ? (
        <div className="space-y-1">
          <Label htmlFor="sales-seat-2">Second salesperson</Label>
          <select
            id="sales-seat-2"
            value={second}
            onChange={(e) => setSlot(1, e.target.value)}
            className="flex h-10 w-full rounded-sm bg-card px-3 text-sm shadow-[var(--shadow-border)] outline-none"
          >
            <option value="">None</option>
            {seats.map((seat) => {
              const email = seat.email.trim().toLowerCase();
              return (
                <option key={`second-${seat.id || email}`} value={email} disabled={email === first}>
                  {seatLabel(seat)}
                </option>
              );
            })}
          </select>
          <p className="text-sm text-muted-foreground">Optional. Use when two trades have different employees.</p>
        </div>
      ) : null}
    </div>
  );
}
