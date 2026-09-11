import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { compressImage } from "@/lib/housefile/image";
import {
  MANAGE_SEAT_ANNUAL,
  MANAGE_SEAT_MONTHLY,
  dollars,
} from "@/lib/housefile/pricing";
import { addOfficeMember, getPortfolio, listOfficeTeam, updatePortfolio } from "@/lib/housefile/server";
import { manageSeatKind } from "@/lib/housefile/stripe";
import { confirmManageCheckout, startBillingPortal, startCheckout } from "@/lib/housefile/stripe-billing";
import { cn } from "@/lib/utils";
import { z } from "zod";

const searchSchema = z.object({
  session_id: z.string().optional(),
});

export const Route = createFileRoute("/manage/settings")({
  validateSearch: (s) => searchSchema.parse(s),
  component: OfficeSettings,
});

function OfficeSettings() {
  const search = Route.useSearch();
  const q = useQuery({ queryKey: ["portfolio"], queryFn: () => getPortfolio() });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    if (!q.data) return;
    setName(q.data.name);
    setPhone(q.data.phone ?? "");
    setEmail(q.data.email ?? "");
    setLogo(q.data.logo_src ?? null);
  }, [q.data]);

  const save = useMutation({
    mutationFn: () =>
      updatePortfolio({
        data: {
          name,
          phone,
          email,
          logo_src: logo,
        },
      }),
    onSuccess: () => {
      toast.success("Office updated");
      void q.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save"),
  });

  const portal = useMutation({
    mutationFn: () => startBillingPortal({ data: { returnPath: "/manage/settings" } }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not open billing"),
  });

  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  if (q.error || !q.data) return <p className="text-destructive">Could not load the office.</p>;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Office settings</h1>
        <p className="text-muted-foreground">This name appears on the portfolio and owner invitations.</p>
      </div>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.data.role !== "owner") return;
          save.mutate();
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="office-name">Office name</Label>
          <Input
            id="office-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="organization"
            disabled={q.data.role !== "owner"}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="office-phone">Phone</Label>
          <Input
            id="office-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            disabled={q.data.role !== "owner"}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="office-email">Email</Label>
          <Input
            id="office-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={q.data.role !== "owner"}
          />
          <p className="text-sm text-muted-foreground">Contact email for the office. Login email stays on Account.</p>
        </div>
        <div className="space-y-2">
          <Label>Logo</Label>
          {logo ? <img src={logo} alt="" className="h-12 w-auto object-contain" /> : null}
          {q.data.role === "owner" ? (
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md bg-card px-4 text-sm shadow-[var(--shadow-border)]">
            {logo ? "Change logo" : "Upload logo"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void compressImage(file, 600)
                  .then(setLogo)
                  .catch((err) => toast.error(err instanceof Error ? err.message : "Could not read logo"));
              }}
            />
          </label>
          ) : null}
        </div>
        {q.data.role === "owner" ? (
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Only the office owner can change this.</p>
        )}
      </form>
      <OfficeTeam sessionId={search.session_id} owner={q.data.role === "owner"} />
      <section className="space-y-3 border-t border-border pt-8">
        <div>
          <h2 className="font-display text-2xl font-medium tracking-tight">Billing</h2>
          <p className="text-sm text-muted-foreground">
            Portfolio subscription and extra houses. Cancel anytime — access continues through the paid
            period.
          </p>
        </div>
        {q.data.role === "owner" ? (
          <Button type="button" variant="outline" disabled={portal.isPending} onClick={() => portal.mutate()}>
            {portal.isPending ? "Opening…" : "Cancel or manage subscription"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Billing stays with the office owner.</p>
        )}
      </section>
    </div>
  );
}

function OfficeTeam({ sessionId, owner }: { sessionId?: string; owner: boolean }) {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ["office-team"], queryFn: () => listOfficeTeam() });
  const [email, setEmail] = useState("");
  const [needSeat, setNeedSeat] = useState(false);
  const [cadence, setCadence] = useState<"monthly" | "annual">("monthly");
  const extraPrice = cadence === "annual" ? MANAGE_SEAT_ANNUAL : MANAGE_SEAT_MONTHLY;

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    void confirmManageCheckout({ data: sessionId })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          toast.error("Checkout did not finish. Try adding the seat again.");
          return;
        }
        await queryClient.invalidateQueries({ queryKey: ["office-team"] });
        await queryClient.invalidateQueries({ queryKey: ["portfolio"] });
        setNeedSeat(false);
        toast.success("Office seat added to the plan.");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Could not confirm checkout.");
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, queryClient]);

  const add = useMutation({
    mutationFn: () => addOfficeMember({ data: { email } }),
    onSuccess: (res) => {
      if (res.needSeat) {
        setNeedSeat(true);
        return;
      }
      toast.success(res.already ? "They already have a seat" : "They can sign in with that email");
      setEmail("");
      void q.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add"),
  });

  const extra = useMutation({
    mutationFn: () =>
      startCheckout({
        data: {
          kind: manageSeatKind(cadence),
          quantity: 1,
          successPath: "/manage/settings",
          cancelPath: "/manage/settings",
        },
      }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not start checkout"),
  });

  if (q.isLoading) return <Skeleton className="h-24 w-full" />;
  const members = q.data?.members ?? [];
  const cap = q.data?.seatCap ?? 1;

  return (
    <section className="space-y-4 border-t border-border pt-8">
      <div>
        <h2 className="font-display text-2xl font-medium tracking-tight">Office seats</h2>
        <p className="text-sm text-muted-foreground">
          {members.length} of {cap} {cap === 1 ? "seat" : "seats"}. Staff see the same houses. They
          do not change office name, billing, or who else sits here.
        </p>
      </div>
      <ul className="divide-y divide-border rounded-xl bg-card shadow-[var(--shadow-border)]">
        {members.map((m) => (
          <li key={m.id} className="flex min-h-12 items-center justify-between px-4 py-2 text-sm">
            <span>{m.email}</span>
            <span className="text-muted-foreground">{m.role === "owner" ? "Owner" : "Staff"}</span>
          </li>
        ))}
      </ul>
      {owner && needSeat ? (
        <div className="space-y-4 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="font-medium">This office is out of seats.</p>
          <p className="text-sm text-muted-foreground">
            Pay for one extra seat, then add their email. Card details stay on Stripe.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setCadence("monthly")}
              className={cn(
                "rounded-xl p-4 text-left shadow-[var(--shadow-border)]",
                cadence === "monthly" ? "bg-primary text-primary-foreground" : "bg-background",
              )}
            >
              <p className="font-medium">${dollars(MANAGE_SEAT_MONTHLY)} / month</p>
              <p className={cn("mt-1 text-sm", cadence === "monthly" ? "opacity-80" : "text-muted-foreground")}>
                One extra seat
              </p>
            </button>
            <button
              type="button"
              onClick={() => setCadence("annual")}
              className={cn(
                "rounded-xl p-4 text-left shadow-[var(--shadow-border)]",
                cadence === "annual" ? "bg-primary text-primary-foreground" : "bg-background",
              )}
            >
              <p className="font-medium">${dollars(MANAGE_SEAT_ANNUAL)} / year</p>
              <p className={cn("mt-1 text-sm", cadence === "annual" ? "opacity-80" : "text-muted-foreground")}>
                One extra seat
              </p>
            </button>
          </div>
          <Button type="button" className="w-full" disabled={extra.isPending} onClick={() => extra.mutate()}>
            {extra.isPending ? "Sending you to Stripe…" : `Continue to Stripe · $${dollars(extraPrice)}`}
          </Button>
        </div>
      ) : owner ? (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <Input
            type="email"
            placeholder="staff@theoffice.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" disabled={add.isPending || !email.trim()}>
            {add.isPending ? "Adding…" : "Add staff"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
