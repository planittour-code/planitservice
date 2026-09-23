import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { TradeSelectDialog } from "@/components/trade-select-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { compressImage } from "@/lib/housefile/image";
import { PAYMENT_TERM_LABELS, PAYMENT_TERMS, asPaymentTerms } from "@/lib/housefile/payment";
import { SEAT_MONTHLY, SHOP_MONTHLY, dollars } from "@/lib/housefile/pricing";
import { parseTradeTokens, workTypesFor } from "@/lib/housefile/quote";
import { addTeamMember, getDashboard, listTeam, updateCompany } from "@/lib/housefile/server";
import { shopSeatKind } from "@/lib/housefile/stripe";
import { confirmShopSeatCheckout, startBillingPortal, startCheckout } from "@/lib/housefile/stripe-billing";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  session_id: z.string().optional(),
});

export const Route = createFileRoute("/app/settings")({
  validateSearch: (s) => searchSchema.parse(s),
  component: SettingsPage,
});

function SettingsPage() {
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const [name, setName] = useState("");
  const [trade, setTrade] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [agreement, setAgreement] = useState("");
  const [terms, setTerms] = useState("");
  const [paymentTerms, setPaymentTerms] = useState<(typeof PAYMENT_TERMS)[number]>("due_completion");
  const [paymentLink, setPaymentLink] = useState("");
  const [pickingTrades, setPickingTrades] = useState(false);

  useEffect(() => {
    if (!q.data) return;
    setName(q.data.company.name);
    setTrade(q.data.company.trade);
    setPhone(q.data.company.phone ?? "");
    setEmail(q.data.company.email ?? "");
    setLogo(q.data.company.logo_src ?? null);
    setAgreement(q.data.company.agreement ?? "");
    setTerms(q.data.company.terms ?? "");
    setPaymentTerms(asPaymentTerms(q.data.company.payment_terms));
    setPaymentLink(q.data.company.payment_link ?? "");
  }, [q.data]);

  const save = useMutation({
    mutationFn: () =>
      updateCompany({
        data: {
          name,
          trade,
          phone,
          email,
          logo_src: logo,
          agreement,
          terms,
          payment_terms: paymentTerms,
          payment_link: paymentLink,
        },
      }),
    onSuccess: () => {
      toast.success("Shop updated");
      void q.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save"),
  });
  const saveTrades = useMutation({
    mutationFn: (ids: string[]) => {
      const company = q.data?.company;
      if (!company) throw new Error("Shop not loaded");
      return updateCompany({
        data: {
          name: company.name,
          trade: company.trade,
          phone: company.phone ?? "",
          email: company.email ?? "",
          trades: ids.join(","),
        },
      });
    },
    onSuccess: () => {
      toast.success("Services updated");
      setPickingTrades(false);
      void q.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save services"),
  });

  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  if (q.error || !q.data) return <p className="text-destructive">Could not load the shop.</p>;
  const company = q.data.company;
  const owner = q.data.role === "owner";
  const trades = workTypesFor(company.trades);
  const tradeIds = parseTradeTokens(company.trades);
  const publicUrl = company.slug ? `https://planitservice.com/s/${company.slug}` : "";

  return (
    <div className="space-y-2">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight">Shop settings</h1>
        <p className="text-muted-foreground">
          {owner
            ? "This name appears on proposals and invitations."
            : "Your sales page uses this shop. Materials and quotes you edit stay on your page."}
        </p>
      </div>
      {owner ? (
      <>
      <section className="space-y-2">
        <div>
          <h2 className="font-display text-lg font-medium">Services Offered</h2>
          <p className="text-sm text-muted-foreground">
            ${dollars(SHOP_MONTHLY)}/month per category. These are the only trades this shop quotes,
            and the only Request Estimates you receive.
          </p>
        </div>
        {trades.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No categories yet. Add the work you want to offer — you will not see Request Estimates
            until you pick at least one.
          </p>
        ) : null}
        <ul className="flex flex-wrap gap-2">
          {trades.map((work) => (
            <li key={work.id}>
              <button
                type="button"
                onClick={() => setPickingTrades(true)}
                className="inline-flex h-7 items-center rounded-md border border-border bg-background px-2 text-xs"
              >
                {work.name}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setPickingTrades(true)}
              className="inline-flex h-7 items-center rounded-md border border-border bg-background px-2 text-xs"
            >
              +Add
            </button>
          </li>
        </ul>
        {trades.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {trades.length} {trades.length === 1 ? "category" : "categories"} · $
            {dollars(trades.length * SHOP_MONTHLY)} / month
          </p>
        ) : null}
      </section>
      <TradeSelectDialog
        open={pickingTrades}
        selected={tradeIds}
        onClose={() => setPickingTrades(false)}
        onSave={(ids) => saveTrades.mutate(ids)}
        busy={saveTrades.isPending}
      />
      {publicUrl ? (
        <section className="space-y-2">
          <div>
            <h2 className="font-display text-lg font-medium">Public page</h2>
            <p className="break-all text-sm text-muted-foreground">
              <a className="underline underline-offset-4" href={`/s/${company.slug}`} target="_blank" rel="noreferrer">
                {publicUrl}
              </a>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a href={`/s/${company.slug}`} target="_blank" rel="noreferrer">
                View public shop
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(publicUrl).then(
                  () => toast.success("Public URL copied"),
                  () => toast.error("Could not copy the URL"),
                );
              }}
            >
              Copy URL
            </Button>
          </div>
        </section>
      ) : null}
      <form
        className="space-y-1.5 border-t border-border pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="space-y-0.5">
          <Label htmlFor="cn">Company</Label>
          <Input id="cn" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-0.5">
          <Label htmlFor="tr">Trade</Label>
          <Input id="tr" value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="paint, roofing, general" />
        </div>
        <div className="space-y-0.5">
          <Label htmlFor="ph">Phone</Label>
          <Input id="ph" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-0.5">
          <Label htmlFor="em">Email</Label>
          <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Logo</Label>
          {logo ? (
            <img src={logo} alt="" className="h-10 w-auto max-w-[9rem] object-contain" />
          ) : null}
          <label className="inline-flex h-7 cursor-pointer items-center rounded-md bg-card px-2 text-xs shadow-[var(--shadow-border)]">
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
        </div>
        <div className="space-y-0.5">
          <Label htmlFor="ag">Estimate language</Label>
          <Textarea id="ag" rows={4} value={agreement} onChange={(e) => setAgreement(e.target.value)} />
        </div>
        <div className="space-y-0.5">
          <Label htmlFor="tm">Terms and conditions</Label>
          <Textarea id="tm" rows={5} value={terms} onChange={(e) => setTerms(e.target.value)} />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Payment terms</legend>
          <p className="text-sm text-muted-foreground">
            This goes on the accepted-estimate email with a PDF of the estimate.
          </p>
          <div className="grid gap-2">
            {PAYMENT_TERMS.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setPaymentTerms(kind)}
                className={cn(
                  "rounded-xl p-4 text-left shadow-[var(--shadow-border)]",
                  paymentTerms === kind ? "bg-primary text-primary-foreground" : "bg-background",
                )}
              >
                <p className="font-medium">{PAYMENT_TERM_LABELS[kind]}</p>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="space-y-0.5">
          <Label htmlFor="pay">Payment link</Label>
          <Input
            id="pay"
            inputMode="url"
            placeholder="https://pay.example.com/your-shop"
            value={paymentLink}
            onChange={(e) => setPaymentLink(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Venmo, PayPal, Square, or any URL you already use. Homeowners get this after they accept.
          </p>
        </div>
        <Button type="submit" disabled={save.isPending}>
          Save
        </Button>
      </form>
      </>
      ) : null}
      <section className="space-y-2 border-t border-border pt-4">
        <div>
          <h2 className="font-display text-lg font-medium tracking-tight">Materials</h2>
          <p className="text-sm text-muted-foreground">
            Materials this shop sells. Add a product, set cost and sell. Quotes pick from here.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/book">Open materials</Link>
        </Button>
      </section>
      {owner ? <TeamSection /> : null}
      {owner ? <BillingSection /> : null}
    </div>
  );
}

function BillingSection() {
  const portal = useMutation({
    mutationFn: () => startBillingPortal({ data: { returnPath: "/app/settings" } }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not open billing"),
  });

  return (
    <section className="space-y-2 border-t border-border pt-4">
      <div>
        <h2 className="font-display text-lg font-medium tracking-tight">Billing</h2>
        <p className="text-sm text-muted-foreground">
          ${dollars(SHOP_MONTHLY)}/month per category you offer, plus ${dollars(SEAT_MONTHLY)}/month
          per sales seat. Adding or removing a category updates the subscription. Cancel anytime —
          access continues through the paid period.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={portal.isPending}
        onClick={() => portal.mutate()}
      >
        {portal.isPending ? "Opening…" : "Cancel or manage subscription"}
      </Button>
    </section>
  );
}

function TeamSection() {
  const search = Route.useSearch();
  const sessionId = search.session_id;
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ["team"], queryFn: () => listTeam() });
  const [email, setEmail] = useState("");
  const [needSeat, setNeedSeat] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    void confirmShopSeatCheckout({ data: sessionId })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          toast.error("Checkout did not finish. Try adding the seat again.");
          return;
        }
        await queryClient.invalidateQueries({ queryKey: ["team"] });
        setNeedSeat(false);
        toast.success("Sales seat added. You can invite them now.");
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
    mutationFn: () => addTeamMember({ data: { email, role: "sales" } }),
    onSuccess: (res) => {
      if (res.needSeat) {
        setNeedSeat(true);
        return;
      }
      toast.success(
        res.already
          ? "They already have a seat"
          : res.emailed
            ? "Welcome email sent. They can log in from that email."
            : "They can sign in with that email",
      );
      setEmail("");
      void q.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add"),
  });
  const extra = useMutation({
    mutationFn: () =>
      startCheckout({
        data: {
          kind: shopSeatKind("monthly"),
          quantity: 1,
          successPath: "/app/settings",
          cancelPath: "/app/settings",
        },
      }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not start checkout"),
  });
  if (q.isLoading) return <Skeleton className="h-24 w-full" />;
  const owner = q.data?.role === "owner";
  const members = q.data?.members ?? [];
  const cap = q.data?.seatCap ?? 0;
  const salesCount = q.data?.salesCount ?? members.filter((m) => m.role === "sales").length;
  return (
    <section className="space-y-2 border-t border-border pt-4">
      <div>
        <h2 className="font-display text-lg font-medium tracking-tight">Sales team</h2>
        <p className="text-sm text-muted-foreground">
          ${dollars(SEAT_MONTHLY)}/month per sales seat. Each salesperson gets a copy of the
          contractor page — their sub-categories, line items, and invoices stay on their page and do
          not change yours. We email them a welcome letter with a login link.
        </p>
        <p className="text-sm text-muted-foreground">
          {salesCount} of {cap} {cap === 1 ? "sales seat" : "sales seats"} paid.
        </p>
      </div>
      <ul className="divide-y divide-border rounded-xl bg-card shadow-[var(--shadow-border)]">
        {members.map((m) => (
          <li key={m.id} className="flex min-h-12 items-center justify-between px-4 py-2 text-sm">
            <span>{m.email}</span>
            <span className="text-muted-foreground">{m.role === "owner" ? "Owner" : "Sales"}</span>
          </li>
        ))}
      </ul>
      {owner && needSeat ? (
        <div className="space-y-2 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
          <p className="font-medium">This shop is out of sales seats.</p>
          <p className="text-sm text-muted-foreground">
            Pay ${dollars(SEAT_MONTHLY)}/month for one seat, then add their email. Card details stay
            on Stripe.
          </p>
          <Button type="button" disabled={extra.isPending} onClick={() => extra.mutate()}>
            {extra.isPending ? "Opening…" : `Add a $${dollars(SEAT_MONTHLY)} sales seat`}
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
            placeholder="salesperson@theshop.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" disabled={add.isPending || !email.trim()}>
            {add.isPending ? "Adding…" : "Add salesperson"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
