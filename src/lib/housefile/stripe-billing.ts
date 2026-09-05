import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { CheckoutKind } from "@/lib/housefile/stripe";
import {
  claimPaidShopSession,
  confirmPaidShopSession,
  createCheckoutSessionUrl,
  createPortalSessionUrl,
} from "@/lib/housefile/stripe.server";

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

/** Guest contractor: Stripe-hosted Checkout before any PlanitService account. */
export const startShopCheckout = createServerFn({ method: "POST" })
  .validator((input: { kind: "shop_monthly" | "shop_annual"; shopName?: string }) => input)
  .handler(async ({ data }) => {
    const url = await createCheckoutSessionUrl({
      kind: data.kind,
      shopName: data.shopName,
      successPath: "/shop/open",
      cancelPath: "/shop/open",
    });
    return { url };
  });

export const claimShopCheckout = createServerFn({ method: "POST" })
  .validator((input: { sessionId: string; password: string; name?: string }) => input)
  .handler(async ({ data }) => {
    return claimPaidShopSession(data);
  });

export const confirmShopCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((sessionId: string) => sessionId)
  .handler(async ({ context, data: sessionId }) => {
    return confirmPaidShopSession({ sessionId, userId: context.userId });
  });

export const startBillingPortal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { returnPath: string }) => input)
  .handler(async ({ data }) => {
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const url = await createPortalSessionUrl({
      customerEmail: session?.email,
      returnPath: data.returnPath,
    });
    return { url };
  });
