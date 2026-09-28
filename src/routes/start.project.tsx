import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/start/project")({ component: StartProjectRedirect });

function StartProjectRedirect() {
  return <Navigate to="/s/$slug/project" params={{ slug: "painting-plus" }} />;
}
