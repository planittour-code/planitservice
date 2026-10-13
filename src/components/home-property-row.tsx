import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AddressClaimNote } from "@/components/address-claim-note";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { removeHomeProperty, setPrimaryResidence, updateHomeProperty } from "@/lib/housefile/server";
import { PROPERTY_ANNUAL, PROPERTY_MONTHLY, PRO_ANNUAL, PRO_MONTHLY, dollars } from "@/lib/housefile/pricing";
import { BILLING_PORTAL } from "@/lib/housefile/stripe";
import { startBillingPortal } from "@/lib/housefile/stripe-billing";
import { useAddressClaimed } from "@/lib/housefile/use-address-claim";

export type HomePropertyRowHouse = {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  cadence: string | null;
  tier: string | null;
  status: string | null;
  renewsOn: string | null;
  isPrimaryResidence: boolean;
};

export function HomePropertyRow({
  house,
  houseCount = 2,
}: {
  house: HomePropertyRowHouse;
  houseCount?: number;
}) {
  const queryClient = useQueryClient();
  const lastHouse = houseCount <= 1;
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [address, setAddress] = useState(house.address);
  const [city, setCity] = useState(house.city);
  const [state, setState] = useState(house.state);
  const [zip, setZip] = useState(house.zip);
  const claimed = useAddressClaimed(address, zip);

  useEffect(() => {
    setAddress(house.address);
    setCity(house.city);
    setState(house.state);
    setZip(house.zip);
  }, [house]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["account"] });
    void queryClient.invalidateQueries({ queryKey: ["household"] });
    void queryClient.invalidateQueries({ queryKey: ["home-record"] });
  };

  const save = useMutation({
    mutationFn: () =>
      updateHomeProperty({
        data: {
          propertyId: house.id,
          addressLine: address,
          city,
          state,
          zip,
        },
      }),
    onSuccess: () => {
      toast.success("Address updated");
      setEditing(false);
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save"),
  });

  const remove = useMutation({
    mutationFn: () => removeHomeProperty({ data: { propertyId: house.id } }),
    onSuccess: () => {
      toast.success("Property removed from this account");
      setConfirming(false);
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not remove"),
  });

  const portal = useMutation({
    mutationFn: () => startBillingPortal({ data: { returnPath: "/home/settings" } }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: () => {
      window.location.href = BILLING_PORTAL;
    },
  });

  const makePrimary = useMutation({
    mutationFn: () => setPrimaryResidence({ data: { propertyId: house.id } }),
    onSuccess: () => {
      toast.success("Primary residence updated");
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update"),
  });

  const planLine = house.tier
    ? `${house.tier === "pro" ? "Pro" : "Standard"} · ${house.cadence === "annual" ? "annual" : "monthly"}`
    : house.status === "complimentary"
      ? "Complimentary"
      : house.status === "lapsed"
        ? "Free period ended"
        : "No paid plan yet";
  const priceLine = house.tier
    ? ` · $${dollars(house.tier === "pro" ? (house.cadence === "annual" ? PRO_ANNUAL : PRO_MONTHLY) : house.cadence === "annual" ? PROPERTY_ANNUAL : PROPERTY_MONTHLY)}${house.cadence === "annual" ? "/year" : "/month"}`
    : "";

  return (
    <li className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            {house.address}
            {house.city ? `, ${house.city}` : ""}
            {house.state ? ` ${house.state}` : ""}
            {house.zip ? ` ${house.zip}` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            {house.isPrimaryResidence ? "Primary residence · " : ""}
            {planLine}
            {house.renewsOn ? ` · renews ${formatDay(house.renewsOn)}` : ""}
            {priceLine}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {house.isPrimaryResidence ? (
            <span className="inline-flex h-7 items-center rounded-md bg-muted px-2 text-xs font-medium">
              Primary residence
            </span>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={makePrimary.isPending}
              onClick={() => makePrimary.mutate()}
            >
              {makePrimary.isPending ? "Saving…" : "Primary residence"}
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing((open) => !open)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={remove.isPending || portal.isPending}
            onClick={() => setConfirming(true)}
          >
            Remove this property
          </Button>
        </div>
      </div>
      {confirming ? (
        <div className="fixed inset-0 z-50 grid place-items-end p-4 sm:place-items-center">
          <button
            type="button"
            className="absolute inset-0 bg-ink/50"
            aria-label="Close"
            onClick={() => setConfirming(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`remove-house-${house.id}`}
            className="relative w-full max-w-md rounded-xl bg-card p-5 shadow-[var(--shadow-border)]"
          >
            {lastHouse ? (
              <>
                <h3 id={`remove-house-${house.id}`} className="font-display text-xl font-medium tracking-tight">
                  This is the only house on this account
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {house.address}
                  {house.city ? `, ${house.city}` : ""}
                  {house.state ? ` ${house.state}` : ""}
                  {house.zip ? ` ${house.zip}` : ""}. Cancel the Property Record plan in billing
                  instead of deleting the last file.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
                    Keep this house
                  </Button>
                  <Button type="button" disabled={portal.isPending} onClick={() => portal.mutate()}>
                    {portal.isPending ? "Opening billing…" : "Continue to billing"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h3 id={`remove-house-${house.id}`} className="font-display text-xl font-medium tracking-tight">
                  Remove this property?
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Double-check the address. {house.address}
                  {house.city ? `, ${house.city}` : ""}
                  {house.state ? ` ${house.state}` : ""}
                  {house.zip ? ` ${house.zip}` : ""} will leave this account.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
                    Keep this house
                  </Button>
                  <Button type="button" disabled={remove.isPending} onClick={() => remove.mutate()}>
                    {remove.isPending ? "Removing…" : "Remove this property"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
      {editing ? (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`house-address-${house.id}`}>Street</Label>
            <Input
              id={`house-address-${house.id}`}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`house-city-${house.id}`}>City</Label>
            <Input
              id={`house-city-${house.id}`}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`house-state-${house.id}`}>State</Label>
              <Input
                id={`house-state-${house.id}`}
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`house-zip-${house.id}`}>ZIP</Label>
              <Input
                id={`house-zip-${house.id}`}
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="sm:col-span-2 space-y-2">
            {claimed ? <AddressClaimNote claimed /> : null}
            <Button type="submit" size="sm" disabled={save.isPending || claimed}>
              {save.isPending ? "Saving…" : "Save address"}
            </Button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

function formatDay(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
