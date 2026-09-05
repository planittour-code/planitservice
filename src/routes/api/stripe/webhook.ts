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
              subscription?: string | null;
            };
            const propertyId = session.metadata?.propertyId;
            if (propertyId) {
              const sql = await getSql();
              await sql`
                update property_plans
                set status = ${"active"}
                where property_id = ${propertyId}
              `;
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
