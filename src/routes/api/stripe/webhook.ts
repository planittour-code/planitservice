import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { getStripe } from "@/lib/housefile/stripe.server";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
        if (!secret) {
          return new Response("Webhook not configured", { status: 503 });
        }
        const stripe = getStripe();
        const signature = request.headers.get("stripe-signature");
        if (!signature) return new Response("No signature", { status: 400 });

        const raw = await request.text();
        let event;
        try {
          event = stripe.webhooks.constructEvent(raw, signature, secret);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Invalid payload";
          return new Response(`Webhook Error: ${msg}`, { status: 400 });
        }

        try {
          if (event.type === "checkout.session.completed") {
            const session = event.data.object as {
              metadata?: { userId?: string; kind?: string; propertyId?: string };
              customer?: string | null;
              customer_email?: string | null;
              customer_details?: { email?: string | null } | null;
              subscription?: string | null;
            };
            const propertyId = session.metadata?.propertyId?.trim();
            const kind = session.metadata?.kind ?? "";
            const userId = session.metadata?.userId;
            if (propertyId) {
              const sql = await getSql();
              await sql`
                update property_plans
                set status = ${"active"}
                where property_id = ${propertyId}
              `;
            }
            if (userId && (kind === "shop_monthly" || kind === "shop_annual")) {
              const { markShopPaid } = await import("@/lib/housefile/shop-paid.server");
              await markShopPaid(
                userId,
                session.customer_details?.email ?? session.customer_email ?? null,
              );
            }
            console.log("[stripe] checkout.session.completed", session.metadata);
          }
        } catch (err) {
          console.error("[stripe] webhook handler error", err);
          return new Response("Handler failed", { status: 500 });
        }

        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
