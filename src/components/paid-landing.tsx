import { useEffect } from "react";
import { justSignedOut } from "@/lib/auth/client";
import { useAudience } from "@/lib/housefile/use-audience";

/** Paying customers skip marketing and land on their dashboard. */
export function PaidLanding({ prefer }: { prefer?: "homeowner" | "contractor" | "manager" }) {
  const { audience, isPending } = useAudience();
  const signedOut = justSignedOut();
  useEffect(() => {
    if (signedOut) return;
    if (isPending || !audience.paying) return;
    let to = audience.homePath;
    if (prefer === "homeowner") {
      if (!audience.hats.homeowner) return;
      to = "/home";
    } else if (prefer === "contractor") {
      if (!audience.hats.contractor) return;
      to = "/app";
    } else if (prefer === "manager") {
      if (!audience.hats.manager) return;
      to = "/manage";
    }
    if (window.location.pathname === to) return;
    window.location.replace(to);
  }, [audience, isPending, prefer, signedOut]);
  return null;
}
