import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PublicHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bookPublicSlot, getPublicBookingSlots, getPublicShop, startPublicProject } from "@/lib/housefile/server";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/s/$slug/book")({ component: ShopOfferPage });

type Offer = "visit" | "repeat";

function ShopOfferPage() {
  const { slug } = Route.useParams();
  const shop = useQuery({
    queryKey: ["public-shop", slug],
    queryFn: () => getPublicShop({ data: slug }),
    retry: false,
  });
  const slots = useQuery({
    queryKey: ["shop-slots", slug],
    queryFn: () => getPublicBookingSlots({ data: slug }),
    enabled: Boolean(shop.data),
  });
  const shopName = shop.data?.name ?? slots.data?.shop.name ?? "This shop";
  const [offer, setOffer] = useState<Offer | null>(null);
  const [start, setStart] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("GA");
  const [zip, setZip] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const book = useMutation({
    mutationFn: () =>
      bookPublicSlot({ data: { slug, start, service: "cleaning", name, email, phone, address } }),
    onSuccess: (res) => {
      setDone(`Booked for ${res.when}. Confirmation ${res.confirmationCode} is in your email.`);
      toast.success("You're on the calendar.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "That time is not open.");
      void slots.refetch();
    },
  });
  const enroll = useMutation({
    mutationFn: () =>
      startPublicProject({
        data: { slug, name, email, phone, addressLine: address, city, state, zip, workId: "gutters" },
      }),
    onSuccess: () => {
      setDone(`${shopName} has your repeat-service signup. We'll write you to set the first visit.`);
      toast.success("Signed up. The shop has the request.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not sign you up."),
  });

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader compact path="public">
        <Button asChild variant="outline" size="sm">
          <Link to="/s/$slug" params={{ slug }}>
            Shop
          </Link>
        </Button>
      </PublicHeader>
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6">
        <header className="space-y-4">
          {shop.data?.logo_src ? (
            <img
              src={shop.data.logo_src}
              alt=""
              className="h-16 w-auto max-w-[14rem] object-contain sm:h-20"
            />
          ) : null}
          <div className="space-y-2">
            <p className="text-sm font-medium tracking-wide text-primary">{shopName}</p>
            <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
              Annual service package
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              20% off, three visits, and priority scheduling. A one-time visit is on the other side.
            </p>
          </div>
        </header>

        {shop.isError ? (
          <p className="text-sm text-destructive">This shop link is not live yet.</p>
        ) : done ? (
          <section className="space-y-2 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-xl font-medium">You're set</h2>
            <p className="text-sm text-muted-foreground">{done}</p>
          </section>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2">
              <OfferCard
                title="Annual service package"
                points={[
                  "20% off gutter and downspout cleaning",
                  "3 visits: spring, fall, and as needed",
                  "Priority scheduling through the year",
                ]}
                action="Sign up for the year"
                selected={offer === "repeat"}
                featured
                onChoose={() => setOffer("repeat")}
              />
              <OfferCard
                title="One visit"
                points={["Seasonal gutter and downspout cleaning", "Pick an open day on the calendar"]}
                action="Schedule one visit"
                selected={offer === "visit"}
                onChoose={() => setOffer("visit")}
              />
            </section>

            {offer === "visit" ? (
              <form
                className="space-y-4 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]"
                onSubmit={(e) => {
                  e.preventDefault();
                  book.mutate();
                }}
              >
                <h2 className="font-display text-xl font-medium">Schedule one visit</h2>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Open times</legend>
                  {slots.isLoading ? (
                    <p className="text-sm text-muted-foreground">Checking the calendar…</p>
                  ) : slots.data?.slots.length ? (
                    <div className="flex flex-wrap gap-2">
                      {slots.data.slots.slice(0, 12).map((slot) => (
                        <button
                          key={slot.start}
                          type="button"
                          onClick={() => setStart(slot.start)}
                          className={cn(
                            "min-h-11 rounded-md px-3 py-2 text-left text-sm shadow-[var(--shadow-border)]",
                            start === slot.start ? "bg-primary text-primary-foreground" : "bg-background",
                          )}
                        >
                          {slot.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No openings in the next few weeks. Sign up for the year and the shop will find a day.
                    </p>
                  )}
                </fieldset>
                <ContactFields
                  name={name}
                  email={email}
                  phone={phone}
                  address={address}
                  onName={setName}
                  onEmail={setEmail}
                  onPhone={setPhone}
                  onAddress={setAddress}
                />
                <Button type="submit" disabled={!start || book.isPending}>
                  {book.isPending ? "Booking…" : "Book this time"}
                </Button>
              </form>
            ) : null}

            {offer === "repeat" ? (
              <form
                className="space-y-4 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]"
                onSubmit={(e) => {
                  e.preventDefault();
                  enroll.mutate();
                }}
              >
                <h2 className="font-display text-xl font-medium">Sign up for the year</h2>
                <p className="text-sm text-muted-foreground">
                  {shopName} will confirm the three visits and the 20% rate. The Property Record
                  stays free while that estimate is open.
                </p>
                <ContactFields
                  name={name}
                  email={email}
                  phone={phone}
                  address={address}
                  onName={setName}
                  onEmail={setEmail}
                  onPhone={setPhone}
                  onAddress={setAddress}
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="state">State</Label>
                    <Input id="state" value={state} onChange={(e) => setState(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="zip">ZIP</Label>
                    <Input id="zip" value={zip} onChange={(e) => setZip(e.target.value)} />
                  </div>
                </div>
                <Button type="submit" disabled={enroll.isPending}>
                  {enroll.isPending ? "Sending…" : "Sign up for the year"}
                </Button>
              </form>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

function OfferCard({
  title,
  points,
  action,
  selected,
  featured = false,
  onChoose,
}: {
  title: string;
  points: string[];
  action: string;
  selected: boolean;
  featured?: boolean;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChoose}
      className={cn(
        "flex min-h-44 flex-col items-start gap-3 rounded-xl p-5 text-left shadow-[var(--shadow-border)]",
        featured ? "bg-primary text-primary-foreground sm:min-h-56" : "bg-card",
        selected && !featured && "ring-2 ring-primary",
        selected && featured && "ring-2 ring-primary-foreground",
      )}
    >
      <h2 className="font-display text-xl font-medium">{title}</h2>
      <ul className={cn("space-y-1 text-sm", featured ? "text-primary-foreground/85" : "text-muted-foreground")}>
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <span className={cn("mt-auto text-sm font-medium", featured ? "text-primary-foreground" : "text-primary")}>
        {selected ? "Selected" : action}
      </span>
    </button>
  );
}

function ContactFields({
  name,
  email,
  phone,
  address,
  onName,
  onEmail,
  onPhone,
  onAddress,
}: {
  name: string;
  email: string;
  phone: string;
  address: string;
  onName: (value: string) => void;
  onEmail: (value: string) => void;
  onPhone: (value: string) => void;
  onAddress: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor="name">Name</Label>
        <Input id="name" value={name} onChange={(e) => onName(e.target.value)} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(e) => onEmail(e.target.value)} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" value={phone} onChange={(e) => onPhone(e.target.value)} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="address">Street address</Label>
        <Input id="address" value={address} onChange={(e) => onAddress(e.target.value)} required />
      </div>
    </div>
  );
}
