import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/homeowners")({
  component: () => <Navigate to="/" />,
});
