import { Navigate } from "@tanstack/react-router";
import { useAudience } from "@/lib/housefile/use-audience";

/** Paying customers skip marketing and land on their dashboard. */
export function PaidLanding({ prefer }: { prefer?: "homeowner" | "contractor" }) {
  const { audience, isPending } = useAudience();
  if (isPending || !audience.paying) return null;
  if (prefer === "homeowner" && audience.kind === "homeowner") return <Navigate to="/home" />;
  if (prefer === "contractor" && audience.kind === "contractor") return <Navigate to="/app" />;
  if (audience.homePath === "/home" || audience.homePath === "/app") {
    return <Navigate to={audience.homePath} />;
  }
  if (audience.kind === "homeowner") return <Navigate to="/home" />;
  return <Navigate to="/app" />;
}
