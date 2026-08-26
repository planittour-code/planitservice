import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { compressImage } from "@/lib/housefile/image";
import { addTeamMember, getDashboard, listTeam, updateCompany } from "@/lib/housefile/server";
import { startBillingPortal } from "@/lib/housefile/stripe-billing";

export const Route = createFileRoute("/app/settings")({ component: SettingsPage });

function SettingsPage() {
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const [name, setName] = useState("");
  const [trade, setTrade] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [agreement, setAgreement] = useState("");
  const [terms, setTerms] = useState("");

  useEffect(() => {
    if (!q.data) return;
    setName(q.data.company.name);
    setTrade(q.data.company.trade);
    setPhone(q.data.company.phone ?? "");
    setEmail(q.data.company.email ?? "");
    setLogo(q.data.company.logo_src ?? null);
    setAgreement(q.data.company.agreement ?? "");
    setTerms(q.data.company.terms ?? "");
  }, [q.data]);

  const save = useMutation({
    mutationFn: () =>
      updateCompany({
        data: { name, trade, phone, email, logo_src: logo, agreement, terms },
      }),
    onSuccess: () => {
      toast.success("Shop updated");
      void q.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save"),
  });

  if (q.isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Shop settings</h1>
        <p className="text-muted-foreground">This name appears on proposals and invitations.</p>
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="cn">Company</Label>
          <Input id="cn" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tr">Trade</Label>
          <Input id="tr" value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="paint, roofing, general" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ph">Phone</Label>
          <Input id="ph" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="em">Email</Label>
          <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Logo</Label>
          {logo ? <img src={logo} alt="" className="h-12 w-auto object-contain" /> : null}
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
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ag">Estimate language</Label>
          <Textarea id="ag" rows={4} value={agreement} onChange={(e) => setAgreement(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tm">Terms and conditions</Label>
          <Textarea id="tm" rows={5} value={terms} onChange={(e) => setTerms(e.target.value)} />
        </div>
        <Button type="submit" disabled={save.isPending}>
          Save
        </Button>
      </form>
      <TeamSection />
      <BillingSection />
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
    <section className="space-y-3 border-t border-border pt-8">
      <div>
        <h2 className="font-display text-2xl font-medium tracking-tight">Billing</h2>
        <p className="text-sm text-muted-foreground">
          Shop subscription and extra seats. Cancel anytime — access continues through the paid
          period.
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
  const q = useQuery({ queryKey: ["team"], queryFn: () => listTeam() });
  const [email, setEmail] = useState("");
  const add = useMutation({
    mutationFn: () => addTeamMember({ data: { email, role: "sales" } }),
    onSuccess: () => {
      toast.success("They can sign in with that email");
      setEmail("");
      void q.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add"),
  });
  if (q.isLoading) return <Skeleton className="h-24 w-full" />;
  const owner = q.data?.role === "owner";
  return (
    <section className="space-y-4 border-t border-border pt-8">
      <div>
        <h2 className="font-display text-2xl font-medium tracking-tight">Sales team</h2>
        <p className="text-sm text-muted-foreground">
          They quote from the book. If a cost is missing they propose one, and you approve before
          the homeowner sees it.
        </p>
      </div>
      <ul className="divide-y divide-border rounded-xl bg-card shadow-[var(--shadow-border)]">
        {(q.data?.members ?? []).map((m) => (
          <li key={m.id} className="flex min-h-12 items-center justify-between px-4 py-2 text-sm">
            <span>{m.email}</span>
            <span className="text-muted-foreground">{m.role}</span>
          </li>
        ))}
      </ul>
      {owner && (
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
      )}
    </section>
  );
}
