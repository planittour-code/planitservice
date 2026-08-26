import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createHomeProperty } from "@/lib/housefile/server";
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
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("GA");
  const [zip, setZip] = useState("");
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

  const save = useMutation({
    mutationFn: async () => {
      const created = await createHomeProperty({
        data: { addressLine: address, city, state, zip, cadence, tier },
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
      toast.success("File opened. Continue to secure checkout.");
      window.location.href = url;
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not start checkout"),
  });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Add a property</h1>
        <p className="mt-2 text-muted-foreground">
          One File per address. ${dollars(price)} {cadence === "annual" ? "this year" : "per month"}.
        </p>
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="ad">Street</Label>
          <Input id="ad" value={address} onChange={(e) => setAddress(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="ct">City</Label>
            <Input id="ct" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="st">State</Label>
            <Input id="st" value={state} onChange={(e) => setState(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zp">ZIP</Label>
            <Input id="zp" value={zip} onChange={(e) => setZip(e.target.value)} />
          </div>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Plan</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <Choice on={tier === "standard"} title="Standard" body="File, share link, transfer" onClick={() => setTier("standard")} />
            <Choice on={tier === "pro"} title="Pro" body="RFPs and property manager access" onClick={() => setTier("pro")} />
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
        "rounded-xl p-4 text-left shadow-[var(--shadow-border)]",
        on ? "bg-primary text-primary-foreground" : "bg-card",
      )}
    >
      <p className="font-medium">{title}</p>
      <p className={cn("mt-1 text-sm", on ? "opacity-80" : "text-muted-foreground")}>{body}</p>
    </button>
  );
}
