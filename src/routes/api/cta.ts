import { createFileRoute } from "@tanstack/react-router";
import { trackEvent } from "@/lib/housefile/analytics.server";

export const Route = createFileRoute("/api/cta")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { name?: unknown; session?: unknown };
          const name = String(body.name ?? "").slice(0, 80);
          const session = String(body.session ?? "").slice(0, 80);
          if (name) {
            await trackEvent({
              name: "public_cta",
              eventKey: `cta:${name}:${session || "anon"}:${crypto.randomUUID()}`,
              sessionId: session || null,
            });
          }
        } catch {
          /* ignore */
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});
