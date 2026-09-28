import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { slotLabel } from "@/lib/housefile/calendar";
import { cancelShopBooking } from "@/lib/housefile/server";

type Booking = {
  id: string;
  slot_start: string;
  service: string;
  name: string;
  email: string;
  phone: string | null;
  address_line: string | null;
  confirmation_code: string;
  source: string;
};

export function ShopBookings({ items }: { items: Booking[] }) {
  const queryClient = useQueryClient();
  const cancel = useMutation({
    mutationFn: (bookingId: string) => cancelShopBooking({ data: { bookingId } }),
    onSuccess: () => {
      toast.success("Canceled. That time is open again on Albin’s calendar.");
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not cancel"),
  });

  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <div>
        <h2 className="font-display text-lg font-medium">Booked visits</h2>
        <p className="text-sm text-muted-foreground">
          Times taken from the mailer page or the voice agent. They sit on Albin’s Google calendar.
        </p>
      </div>
      <ul className="divide-y divide-border rounded-xl bg-card shadow-[var(--shadow-border)]">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="font-medium">
                {slotLabel(item.slot_start)} · {item.service}
              </p>
              <p className="text-sm text-muted-foreground">
                {item.name}
                {item.address_line ? ` · ${item.address_line}` : ""} · {item.confirmation_code} ·{" "}
                {item.source}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate(item.id)}
            >
              Cancel
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
