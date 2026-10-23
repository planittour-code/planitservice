import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { searchPreview } from "@/lib/housefile/search-preview.server";
import { resolveSearchViewer } from "@/lib/housefile/search.server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "private, no-store" },
  });

/**
 * GET /api/search-preview?property_id=  (Sprint 1 #3, AC 3.3)
 * Related records for a highlighted search hit, scoped exactly like /api/search.
 * Signed out -> 401; not in the caller's scope (or missing) -> 404.
 */
export const Route = createFileRoute("/api/search-preview")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { assertSameSiteRequest, CrossSiteRequestError } = await import(
          "@/lib/auth/isolation.server"
        );
        const { requireUserId, UnauthorizedError } = await import("@/lib/auth/verify.server");
        let userId: string;
        try {
          assertSameSiteRequest();
          userId = await requireUserId();
        } catch (err) {
          if (err instanceof UnauthorizedError) return json({ error: "unauthorized" }, 401);
          if (err instanceof CrossSiteRequestError) return json({ error: "forbidden" }, 403);
          throw err;
        }
        const propertyId = new URL(request.url).searchParams.get("property_id")?.trim() ?? "";
        if (!propertyId) return json({ error: "property_id required" }, 400);
        const sql = await getSql();
        const viewer = await resolveSearchViewer(sql, userId);
        const preview = await searchPreview(sql, viewer, propertyId);
        if (!preview) return json({ error: "not found" }, 404);
        return json({ preview });
      },
    },
  },
});
