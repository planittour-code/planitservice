import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/my")({
  component: () => <Navigate to="/home" />,
});
