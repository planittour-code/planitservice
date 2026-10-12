import { CLAIMED_ADDRESS_MESSAGE, CLAIMED_ADDRESS_NOTE } from "@/lib/housefile/address-claim";
import { cn } from "@/lib/utils";

export function AddressClaimNote({
  claimed,
  tone = "paper",
}: {
  claimed: boolean;
  tone?: "paper" | "on-photo";
}) {
  if (!claimed) {
    return (
      <p
        className={cn(
          "text-sm",
          tone === "on-photo" ? "text-white/85" : "text-muted-foreground",
        )}
      >
        One Property Record per address. If this house is already claimed, double-check the street
        before you continue.
      </p>
    );
  }
  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2",
        tone === "on-photo"
          ? "bg-card text-foreground shadow-[var(--shadow-border)]"
          : "bg-card shadow-[var(--shadow-border)]",
      )}
    >
      <p className="text-sm font-medium">{CLAIMED_ADDRESS_MESSAGE}</p>
      <p className="mt-1 text-sm text-muted-foreground">{CLAIMED_ADDRESS_NOTE}</p>
    </div>
  );
}
