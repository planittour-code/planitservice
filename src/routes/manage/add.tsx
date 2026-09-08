import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addPortfolioProperty } from "@/lib/housefile/server";
import {
  MANAGE_EXTRA_ANNUAL,
  MANAGE_EXTRA_MONTHLY,
  MANAGE_INCLUDED,
  dollars,
} from "@/lib/housefile/pricing";
import { manageExtraKind } from "@/lib/housefile/stripe";
import { confirmManageCheckout, startCheckout } from "@/lib/housefile/stripe-billing";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  session_id: z.string().optional(),
});

const PENDING_KEY = "manage-add-pending";

type PendingHouse = {
  addressLine: string;
  city: string;
  state: string;
  zip: string;
  ownerName: string;
};

export const Route = createFileRoute("/manage/add")({
  validateSearch: (s) => searchSchema.parse(s),
  component: AddPortfolioHouse,
});

function readPending(): PendingHouse | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingHouse;
  } catch {
    return null;
  }
}

function AddPortfolioHouse() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("GA");
  const [zip, setZip] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [needExtra, setNeedExtra] = useState(false);
  const [cadence, setCadence] = useState<"monthly" | "annual">("monthly");
  const [confirming, setConfirming] = useState(Boolean(search.session_id));

  const extraPrice = cadence === "annual" ? MANAGE_EXTRA_ANNUAL : MANAGE_EXTRA_MONTHLY;

  const save = useMutation({
    mutationFn: (input: PendingHouse) =>
      addPortfolioProperty({
        data: {
          addressLine: input.addressLine,
          city: input.city,
          state: input.state,
          zip: input.zip,
          ownerName: input.ownerName || undefined,
        },
      }),
    onSuccess: (res, input) => {
      if (!res.ok && res.needExtra) {
        setNeedExtra(true);
        try {
          sessionStorage.setItem(PENDING_KEY, JSON.stringify(input));
        } catch {
          /* ignore */
        }
        return;
      }
      if (res.ok) {
        try {
          sessionStorage.removeItem(PENDING_KEY);
        } catch {
          /* ignore */
        }
        void queryClient.invalidateQueries({ queryKey: ["portfolio"] });
        void navigate({ to: "/manage/$id", params: { id: res.propertyId } });
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add the house"),
  });

  const extra = useMutation({
    mutationFn: async () => {
      const pending: PendingHouse = {
        addressLine: address,
        city,
        state,
        zip,
        ownerName,
      };
      try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
      } catch {
        /* ignore */
      }
      return startCheckout({
        data: {
          kind: manageExtraKind(cadence),
          quantity: 1,
          successPath: "/manage/add",
          cancelPath: "/manage/add",
        },
      });
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not start checkout"),
  });

  useEffect(() => {
    const pending = readPending();
    if (pending) {
      setAddress(pending.addressLine);
      setCity(pending.city);
      setState(pending.state);
      setZip(pending.zip);
      setOwnerName(pending.ownerName);
    }
    if (!search.session_id) {
      setConfirming(false);
      return;
    }
    let cancelled = false;
    setConfirming(true);
    void confirmManageCheckout({ data: search.session_id })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setConfirming(false);
          toast.error("Checkout did not finish. Try adding the house again.");
          return;
        }
        await queryClient.invalidateQueries({ queryKey: ["portfolio"] });
        const house = pending ?? {
          addressLine: address,
          city,
          state,
          zip,
          ownerName,
        };
        setNeedExtra(false);
        if (house.addressLine.trim().length >= 3) {
          save.mutate(house, {
            onSettled: () => {
              if (!cancelled) setConfirming(false);
            },
          });
        } else {
          setConfirming(false);
          toast.success("Extra house added to the plan. Enter the address.");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setConfirming(false);
        toast.error(err instanceof Error ? err.message : "Could not confirm checkout.");
      });
    return () => {
      cancelled = true;
    };
    // Confirm once per session_id return.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.session_id]);

  function onSubmit() {
    save.mutate({
      addressLine: address,
      city,
      state,
      zip,
      ownerName,
    });
  }

  if (confirming) {
    return <p className="text-sm text-muted-foreground">Confirming extra house payment…</p>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Add a house</h1>
        <p className="mt-2 text-muted-foreground">
          Opens a Property Record in this portfolio. The first {MANAGE_INCLUDED} are on the base
          plan.
        </p>
      </div>

      {needExtra ? (
        <div className="space-y-4 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="font-medium">This portfolio is full.</p>
          <p className="text-sm text-muted-foreground">
            Pay for one extra house, then this address is added. Card details stay on Stripe.
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
              <p className="font-medium">${dollars(MANAGE_EXTRA_MONTHLY)} / month</p>
              <p className={cn("mt-1 text-sm", cadence === "monthly" ? "opacity-80" : "text-muted-foreground")}>
                One extra house
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
              <p className="font-medium">${dollars(MANAGE_EXTRA_ANNUAL)} / year</p>
              <p className={cn("mt-1 text-sm", cadence === "annual" ? "opacity-80" : "text-muted-foreground")}>
                One extra house
              </p>
            </button>
          </div>
          <Button
            type="button"
            className="w-full"
            disabled={extra.isPending}
            onClick={() => extra.mutate()}
          >
            {extra.isPending ? "Sending you to Stripe…" : `Continue to Stripe · $${dollars(extraPrice)}`}
          </Button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
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
          <div className="space-y-1.5">
            <Label htmlFor="ow">Owner name (optional)</Label>
            <Input id="ow" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={save.isPending}>
            {save.isPending ? "Opening the record…" : "Open Property Record"}
          </Button>
        </form>
      )}
    </div>
  );
}
