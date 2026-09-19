import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { createHomeProperty, getHousehold } from "@/lib/housefile/server";
import { startCheckout } from "@/lib/housefile/stripe-billing";
import {
  PROPERTY_ANNUAL,
  PROPERTY_MONTHLY,
  PRO_ANNUAL,
  PRO_MONTHLY,
  dollars,
} from "@/lib/housefile/pricing";
import { homeownerKind } from "@/lib/housefile/stripe";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  tier: z.enum(["standard", "pro"]).optional(),
});

export const Route = createFileRoute("/home/add")({
  validateSearch: (s) => searchSchema.parse(s),
  component: AddProperty,
});

function AddProperty() {
  const search = Route.useSearch();
  const { user } = useCurrentUserState();
  const houses = useQuery({ queryKey: ["household"], queryFn: () => getHousehold() });
  const accountEmail = user?.primaryEmail?.trim() || houses.data?.profile?.email?.trim() || "";
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("GA");
  const [zip, setZip] = useState("");
  const [useAccountEmail, setUseAccountEmail] = useState(true);
  const [email, setEmail] = useState("");
  const [cadence, setCadence] = useState<"monthly" | "annual">("monthly");
  const [tier, setTier] = useState<"standard" | "pro">(search.tier ?? "standard");
  const price =
    tier === "pro"
      ? cadence === "annual"
        ? PRO_ANNUAL
        : PRO_MONTHLY
      : cadence === "annual"
        ? PROPERTY_ANNUAL
        : PROPERTY_MONTHLY;

  if ((houses.data?.houses.length ?? 0) > 0 && search.tier) {
    return <Navigate to="/home" />;
  }

  const save = useMutation({
    mutationFn: async () => {
      const created = await createHomeProperty({
        data: {
          addressLine: address,
          city,
          state,
          zip,
          cadence,
          tier,
          useAccountEmail,
          email: useAccountEmail ? accountEmail : email,
        },
      });
      const checkout = await startCheckout({
        data: {
          kind: homeownerKind(tier, cadence),
          propertyId: created.propertyId,
          successPath: "/home",
          cancelPath: "/home/add",
        },
      });
      return checkout;
    },
    onSuccess: ({ url }) => {
      toast.success("Property Record opened. Continue to secure checkout.");
      window.location.href = url;
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not start checkout"),
  });

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Add a property</h1>
        <p className="mt-2 text-muted-foreground">
          One Property Record per address. Use the email you signed up with, or a different one for
          this house. Standard keeps the file and known shops. Pro adds Request Estimates. $
          {dollars(price)} {cadence === "annual" ? "this year" : "per month"}.
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
          <Label htmlFor="ad">Street</Label>
          <Input id="ad" value={address} onChange={(e) => setAddress(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1 col-span-2">
            <Label htmlFor="ct">City</Label>
            <Input id="ct" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="st">State</Label>
            <Input id="st" value={state} onChange={(e) => setState(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="zp">ZIP</Label>
            <Input id="zp" value={zip} onChange={(e) => setZip(e.target.value)} />
          </div>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Email for this Property Record</legend>
          <label className="flex min-h-11 items-start gap-2 rounded-lg bg-card px-3 py-2 text-sm shadow-[var(--shadow-border)]">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={useAccountEmail}
              onChange={(e) => setUseAccountEmail(e.target.checked)}
            />
            <span>
              Use the email I signed up with
              {accountEmail ? (
                <span className="mt-0.5 block text-muted-foreground">{accountEmail}</span>
              ) : null}
            </span>
          </label>
          {!useAccountEmail ? (
            <div className="space-y-1">
              <Label htmlFor="em">Different email</Label>
              <Input
                id="em"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          ) : null}
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Plan</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <Choice
              on={tier === "standard"}
              title="Standard"
              body="File, known shops, maintenance"
              onClick={() => setTier("standard")}
            />
            <Choice
              on={tier === "pro"}
              title="Pro"
              body="Request Estimates from shops that service this address"
              onClick={() => setTier("pro")}
            />
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Billing</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <Choice
              on={cadence === "monthly"}
              title={`$${dollars(tier === "pro" ? PRO_MONTHLY : PROPERTY_MONTHLY)} / month`}
              body="Per property"
              onClick={() => setCadence("monthly")}
            />
            <Choice
              on={cadence === "annual"}
              title={`$${dollars(tier === "pro" ? PRO_ANNUAL : PROPERTY_ANNUAL)} / year`}
              body="Two months free"
              onClick={() => setCadence("annual")}
            />
          </div>
        </fieldset>
        <Button type="submit" className="w-full" disabled={save.isPending}>
          {save.isPending ? "Starting checkout…" : `Continue to checkout · $${dollars(price)}`}
        </Button>
      </form>
    </div>
  );
}

function Choice({
  on,
  title,
  body,
  onClick,
}: {
  on: boolean;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg p-3 text-left shadow-[var(--shadow-border)]",
        on ? "bg-primary text-primary-foreground" : "bg-card",
      )}
    >
      <p className="font-medium">{title}</p>
      <p className={cn("mt-1 text-sm", on ? "opacity-80" : "text-muted-foreground")}>{body}</p>
    </button>
  );
}
