import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PublicHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BOOKING_SERVICES } from "@/lib/housefile/calendar";
import { bookPublicSlot, getPublicBookingSlots } from "@/lib/housefile/server";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/book/albin")({ component: BookAlbin });

function BookAlbin() {
  const slots = useQuery({ queryKey: ["albin-slots"], queryFn: () => getPublicBookingSlots() });
  const [start, setStart] = useState("");
  const [service, setService] = useState<(typeof BOOKING_SERVICES)[number]["id"]>("cleaning");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [booked, setBooked] = useState<{ when: string; code: string } | null>(null);

  const save = useMutation({
    mutationFn: () => bookPublicSlot({ data: { start, service, name, email, phone, address } }),
    onSuccess: (res) => {
      setBooked({ when: res.when, code: res.confirmationCode });
      toast.success("You're on the calendar. Confirmation is in your email.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "That time is not open.");
      void slots.refetch();
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader compact path="choose">
        <Button asChild variant="outline" size="sm">
          <Link to="/start/project">Start a New Project</Link>
        </Button>
      </PublicHeader>
      <main className="mx-auto max-w-xl space-y-6 px-4 py-8 sm:px-6">
        <div className="space-y-2">
          <p className="text-sm font-medium tracking-wide text-primary">Gutters Plus</p>
          <h1 className="font-display text-3xl font-medium tracking-tight">Schedule today</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Openings on Albin’s calendar, with a few days held back so the crew can get there.
            A time you see here is a time the phone line can book too.
          </p>
        </div>

        {booked ? (
          <section className="space-y-2 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-xl font-medium">Booked</h2>
            <p className="text-sm">{booked.when}</p>
            <p className="text-sm text-muted-foreground">Confirmation {booked.code}. Check your email.</p>
          </section>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Visit</legend>
              <div className="flex flex-wrap gap-2">
                {BOOKING_SERVICES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setService(item.id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm shadow-[var(--shadow-border)]",
                      service === item.id ? "bg-primary text-primary-foreground" : "bg-card",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Open times</legend>
              {slots.isLoading ? (
                <p className="text-sm text-muted-foreground">Checking Albin’s calendar…</p>
              ) : slots.data?.slots.length ? (
                <div className="flex flex-wrap gap-2">
                  {slots.data.slots.slice(0, 16).map((slot) => (
                    <button
                      key={slot.start}
                      type="button"
                      onClick={() => setStart(slot.start)}
                      className={cn(
                        "rounded-md px-3 py-2 text-left text-sm shadow-[var(--shadow-border)]",
                        start === slot.start ? "bg-primary text-primary-foreground" : "bg-card",
                      )}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No openings in the next few weeks. Reply to Albin and he will find a day.
                </p>
              )}
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
            </div>
            <Button type="submit" disabled={!start || save.isPending}>
              {save.isPending ? "Booking…" : "Book this time"}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
