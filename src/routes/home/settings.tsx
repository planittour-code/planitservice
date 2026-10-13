import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HomePropertyRow } from "@/components/home-property-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getHousehold, updateHomeownerProfile } from "@/lib/housefile/server";
import { startBillingPortal } from "@/lib/housefile/stripe-billing";

export const Route = createFileRoute("/home/settings")({ component: HouseholdSettings });

function HouseholdSettings() {
  const { user } = useCurrentUserState();
  const q = useQuery({ queryKey: ["household"], queryFn: () => getHousehold() });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!q.data) return;
    setName(q.data.profile?.display_name ?? "");
    setPhone(q.data.profile?.phone ?? "");
    setEmail(q.data.profile?.email ?? user?.primaryEmail ?? "");
  }, [q.data, user?.primaryEmail]);

  const save = useMutation({
    mutationFn: () =>
      updateHomeownerProfile({
        data: {
          displayName: name,
          phone,
          email,
        },
      }),
    onSuccess: () => {
      toast.success("Household updated");
      void q.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save"),
  });

  const portal = useMutation({
    mutationFn: () => startBillingPortal({ data: { returnPath: "/home/settings" } }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not open billing"),
  });

  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  if (q.error) return <p className="text-destructive">Could not load household settings.</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Household settings</h1>
        <p className="text-muted-foreground">
          Your name on this account. Each Property Record still has its own owner name.
        </p>
      </div>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="household-name">Your name</Label>
          <Input id="household-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="household-phone">Phone</Label>
          <Input id="household-phone" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="household-email">Contact email</Label>
          <Input
            id="household-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <p className="text-sm text-muted-foreground">Does not change the email you sign in with.</p>
        </div>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </form>
      <section className="space-y-3 border-t border-border pt-8">
        <div>
          <h2 className="font-display text-2xl font-medium tracking-tight">Properties</h2>
          <p className="text-sm text-muted-foreground">
            Mark the house you live in, edit the street, or remove a house that does not belong on this account.
          </p>
        </div>
        {q.data?.ownedHouses.length ? (
          <ul className="divide-y divide-border rounded-xl bg-card shadow-[var(--shadow-border)]">
            {q.data.ownedHouses.map((h) => (
              <HomePropertyRow
                key={h.id}
                house={{
                  id: h.id,
                  address: h.address_line,
                  city: h.city,
                  state: h.state,
                  zip: h.zip,
                  cadence: h.plan?.cadence ?? null,
                  tier: h.plan?.tier ?? null,
                  status: h.plan?.status ?? null,
                  renewsOn: h.plan?.renews_on ?? null,
                  isPrimaryResidence: Boolean(h.is_primary_residence),
                }}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No Property Record on this account yet.{" "}
            <Link to="/home/add" className="underline underline-offset-2">
              Add a property
            </Link>
            .
          </p>
        )}
      </section>
      <section className="space-y-3 border-t border-border pt-8">
        <div>
          <h2 className="font-display text-2xl font-medium tracking-tight">Billing</h2>
          <p className="text-sm text-muted-foreground">
            Property plans are billed per house. Cancel anytime — access continues through the paid
            period.
          </p>
        </div>
        <Button type="button" variant="outline" disabled={portal.isPending} onClick={() => portal.mutate()}>
          {portal.isPending ? "Opening…" : "Cancel or manage subscription"}
        </Button>
      </section>
    </div>
  );
}
