import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/app/market")({ component: MarketPage });

function MarketPage() {
  return <Navigate to="/app" />;
}
