import { useEffect } from "react";
import { useAudience } from "@/lib/housefile/use-audience";

/** Paying customers skip marketing and land on their dashboard. */
export function PaidLanding({ prefer }: { prefer?: "homeowner" | "contractor" }) {
  const { audience, isPending } = useAudience();
  useEffect(() => {
    if (isPending || !audience.paying) return;
    let to = audience.kind === "homeowner" ? "/home" : "/app";
    if (prefer === "homeowner" && audience.kind === "homeowner") to = "/home";
    if (prefer === "contractor" && audience.kind === "contractor") to = "/app";
    if (window.location.pathname === to) return;
    window.location.replace(to);
  }, [audience, isPending, prefer]);
  return null;
}
