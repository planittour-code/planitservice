import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { CheckoutKind } from "@/lib/housefile/stripe";

export const startCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      kind: CheckoutKind;
      propertyId?: string;
      successPath: string;
      cancelPath: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const { createCheckoutSessionUrl } = await import("@/lib/housefile/stripe.server");
    const session = await getSessionUser();
    const url = await createCheckoutSessionUrl({
      kind: data.kind,
      userId: context.userId,
      propertyId: data.propertyId,
      customerEmail: session?.email,
      successPath: data.successPath,
      cancelPath: data.cancelPath,
    });
    return { url };
  });

export const confirmShopCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((sessionId: string) => sessionId)
  .handler(async ({ context, data: sessionId }) => {
    const { getStripe } = await import("@/lib/housefile/stripe.server");
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid" && session.status !== "complete") {
      return { ok: false as const };
    }
    if (session.metadata?.userId !== context.userId) {
      throw new Error("That checkout belongs to another account.");
    }
    const kind = session.metadata?.kind ?? "";
    if (kind !== "shop_monthly" && kind !== "shop_annual") {
      return { ok: false as const };
    }
    const { markShopPaid } = await import("@/lib/housefile/shop-paid.server");
    await markShopPaid(
      context.userId,
      session.customer_details?.email ?? session.customer_email ?? null,
    );
    return { ok: true as const };
  });

export const startBillingPortal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { returnPath: string }) => input)
  .handler(async ({ context, data }) => {
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const { createPortalSessionUrl } = await import("@/lib/housefile/stripe.server");
    const session = await getSessionUser();
    const url = await createPortalSessionUrl({
      customerEmail: session?.email,
      returnPath: data.returnPath,
    });
    return { url };
  });
