import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/open")({
  component: () => <Navigate to="/shop/open" />,
});
