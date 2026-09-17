import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  PROPERTY_ANNUAL,
  PROPERTY_MONTHLY,
  PRO_ANNUAL,
  PRO_MONTHLY,
  PRO_UPGRADE_ANNUAL,
  PRO_UPGRADE_MONTHLY,
  dollars,
} from "@/lib/housefile/pricing";
import { upgradeHomePropertyToPro } from "@/lib/housefile/server";
import type { PlanCadence } from "@/lib/housefile/types";

export function UpgradeToPro({
  propertyId,
  cadence = "monthly",
  onUpgraded,
}: {
  propertyId: string;
  cadence?: PlanCadence;
  onUpgraded?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const annual = cadence === "annual";
  const monthDelta = PRO_UPGRADE_MONTHLY;
  const yearDelta = PRO_UPGRADE_ANNUAL;
  const from = annual ? PROPERTY_ANNUAL : PROPERTY_MONTHLY;
  const to = annual ? PRO_ANNUAL : PRO_MONTHLY;
  const period = annual ? "year" : "month";
  const acceptDelta = annual ? yearDelta : monthDelta;

  const accept = useMutation({
    mutationFn: () => upgradeHomePropertyToPro({ data: { propertyId } }),
    onSuccess: (res) => {
      toast.success(
        res.alreadyPro
          ? "This property is already Pro."
          : "Upgraded to Pro. Photos, jobs, and shops on this record stayed.",
      );
      onUpgraded?.();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not upgrade"),
  });

  if (!confirming) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Standard keeps this Property Record. Pro adds Request Estimates from shops that service
          this address. Photos, jobs, known shops, and maintenance stay on the account.
        </p>
        <p className="text-sm font-medium">
          Upgrade fee is ${dollars(monthDelta)} extra a month{" "}
          <span className="font-normal text-muted-foreground">
            (${dollars(PROPERTY_MONTHLY)} Standard → ${dollars(PRO_MONTHLY)} Pro)
            {annual
              ? ` · $${dollars(yearDelta)} extra this year ($${dollars(from)} → $${dollars(to)}).`
              : "."}
          </span>
        </p>
        <Button
          type="button"
          className="min-h-11 bg-go text-go-foreground hover:opacity-90"
          onClick={() => setConfirming(true)}
        >
          Upgrade to Pro
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg bg-muted/60 p-3">
      <p className="font-medium">Accept Pro on this Property Record?</p>
      <p className="text-sm text-muted-foreground">
        You pay ${dollars(monthDelta)} more a month
        {annual ? ` (${dollars(yearDelta)} more this year)` : ""} — ${dollars(from)} becomes $
        {dollars(to)}. The house file, photos, jobs, and shops on this login stay. Request Estimates
        turns on after you accept.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="min-h-11 bg-go text-go-foreground hover:opacity-90"
          disabled={accept.isPending}
          onClick={() => accept.mutate()}
        >
          {accept.isPending ? "Upgrading…" : `Accept · +$${dollars(acceptDelta)} / ${period}`}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={accept.isPending}
          onClick={() => setConfirming(false)}
        >
          Keep Standard
        </Button>
      </div>
    </div>
  );
}
