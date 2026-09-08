import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { getStripe, grantManageExtraSlots, markPortfolioPaid } from "@/lib/housefile/stripe.server";

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
              metadata?: {
                userId?: string;
                kind?: string;
                propertyId?: string;
                officeName?: string;
              };
              customer?: string | null;
              subscription?: string | null;
            };
            const propertyId = session.metadata?.propertyId;
            const userId = session.metadata?.userId?.trim();
            const kind = session.metadata?.kind ?? "";
            const customerId = typeof session.customer === "string" ? session.customer : null;
            const subscriptionId =
              typeof session.subscription === "string" ? session.subscription : null;
            if (propertyId) {
              const sql = await getSql();
              await sql`
                update property_plans
                set status = ${"active"}
                where property_id = ${propertyId}
              `;
            }
            if (userId && (kind === "manage_monthly" || kind === "manage_annual")) {
              await markPortfolioPaid(userId, null, session.metadata?.officeName);
            }
            if (userId && (kind === "manage_extra_monthly" || kind === "manage_extra_annual")) {
              const full = await stripe.checkout.sessions.retrieve(event.data.object.id as string, {
                expand: ["line_items"],
              });
              const quantity = full.line_items?.data[0]?.quantity ?? 1;
              await grantManageExtraSlots({
                userId,
                sessionId: event.data.object.id as string,
                quantity,
              });
            }
            if (
              userId &&
              customerId &&
              (kind === "manage_monthly" ||
                kind === "manage_annual" ||
                kind === "manage_extra_monthly" ||
                kind === "manage_extra_annual")
            ) {
              const sql = await getSql();
              await sql`
                update portfolios
                set stripe_customer_id = coalesce(stripe_customer_id, ${customerId}),
                    stripe_subscription_id = coalesce(stripe_subscription_id, ${subscriptionId})
                where user_id = ${userId}
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
