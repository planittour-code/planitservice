import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/app/leads")({ component: LeadsPage });

function LeadsPage() {
  return <Navigate to="/app" />;
}
