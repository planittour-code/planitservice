import { createFileRoute, Navigate } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  tier: z.enum(["standard", "pro"]).optional(),
});

export const Route = createFileRoute("/start")({
  validateSearch: (s) => searchSchema.parse(s),
  component: function StartRedirect() {
    const search = Route.useSearch();
    return <Navigate to="/homeowner" search={search} />;
  },
});
