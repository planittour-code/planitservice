import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { compressImage } from "@/lib/housefile/image";
import { getPortfolio, updatePortfolio } from "@/lib/housefile/server";
import { startBillingPortal } from "@/lib/housefile/stripe-billing";

export const Route = createFileRoute("/manage/settings")({ component: OfficeSettings });

function OfficeSettings() {
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
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="office-name">Office name</Label>
          <Input id="office-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="organization" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="office-phone">Phone</Label>
          <Input id="office-phone" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="office-email">Email</Label>
          <Input
            id="office-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <p className="text-sm text-muted-foreground">Contact email for the office. Login email stays on Account.</p>
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
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </form>
      <section className="space-y-3 border-t border-border pt-8">
        <div>
          <h2 className="font-display text-2xl font-medium tracking-tight">Billing</h2>
          <p className="text-sm text-muted-foreground">
            Portfolio subscription and extra houses. Cancel anytime — access continues through the paid
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
