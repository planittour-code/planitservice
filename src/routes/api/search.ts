import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { addressKey } from "@/lib/housefile/address-claim";
import {
  parseSearchType,
  resolveSearchViewer,
  searchDocuments,
} from "@/lib/housefile/search.server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "private, no-store" },
  });

/**
 * GET /api/search?q=&type=  (Sprint 1 #2)
 * Typed hits {type, id, property_id, label, sublabel, url, match}, max 20.
 * Empty q -> the caller's 10 most recently touched records. Signed out -> 401.
 * Scoping lives in SQL (see search.server.ts).
 */
export const Route = createFileRoute("/api/search")({
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
        const url = new URL(request.url);
        const type = parseSearchType(url.searchParams.get("type"));
        if (type === "invalid") return json({ error: "unknown type" }, 400);
        const sql = await getSql();
        const viewer = await resolveSearchViewer(sql, userId);
        const hits = await searchDocuments(sql, viewer, url.searchParams.get("q") ?? "", type, {
          addressKey,
        });
        return json({ hits });
      },
    },
  },
});
