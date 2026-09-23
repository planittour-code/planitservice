import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { CheckoutKind } from "@/lib/housefile/stripe";
import {
  claimPaidManageSession,
  claimPaidShopSession,
  confirmPaidManageSession,
  confirmPaidShopSeatSession,
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
      officeName?: string;
      quantity?: number;
      trades?: string;
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
      officeName: data.officeName,
      quantity: data.quantity,
      trades: data.trades,
      customerEmail: session?.email,
      successPath: data.successPath,
      cancelPath: data.cancelPath,
    });
    return { url };
  });

/** Guest contractor: Stripe-hosted Checkout before any PlanitService account. */
export const startShopCheckout = createServerFn({ method: "POST" })
  .validator(
    (input: {
      kind: "shop_monthly" | "shop_annual";
      shopName?: string;
      quantity?: number;
      trades?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const url = await createCheckoutSessionUrl({
      kind: data.kind,
      shopName: data.shopName,
      quantity: data.quantity,
      trades: data.trades,
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

export const startManageCheckout = createServerFn({ method: "POST" })
  .validator((input: { kind: "manage_monthly" | "manage_annual"; officeName?: string }) => input)
  .handler(async ({ data }) => {
    // Guest-friendly: if a session exists (soft), attach userId/email so webhook + claim link.
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser().catch(() => null);
    const url = await createCheckoutSessionUrl({
      kind: data.kind,
      userId: session?.id,
      customerEmail: session?.email,
      officeName: data.officeName,
      successPath: "/manage/open",
      cancelPath: "/manage/open",
    });
    return { url };
  });

export const claimManageCheckout = createServerFn({ method: "POST" })
  .validator((input: { sessionId: string; password: string; name?: string }) => input)
  .handler(async ({ data }) => {
    return claimPaidManageSession(data);
  });

export const confirmManageCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((sessionId: string) => sessionId)
  .handler(async ({ context, data: sessionId }) => {
    return confirmPaidManageSession({ sessionId, userId: context.userId });
  });

export const confirmShopCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((sessionId: string) => sessionId)
  .handler(async ({ context, data: sessionId }) => {
    return confirmPaidShopSession({ sessionId, userId: context.userId });
  });

export const confirmShopSeatCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((sessionId: string) => sessionId)
  .handler(async ({ context, data: sessionId }) => {
    return confirmPaidShopSeatSession({ sessionId, userId: context.userId });
  });

export const confirmHomeownerCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((sessionId: string) => sessionId)
  .handler(async ({ context, data: sessionId }) => {
    const { confirmPaidHomeownerSession } = await import("@/lib/housefile/stripe.server");
    return confirmPaidHomeownerSession({ sessionId, userId: context.userId });
  });

export const startBillingPortal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { returnPath: string }) => input)
  .handler(async ({ context, data }) => {
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const { getSql } = await import("@/lib/db");
    const session = await getSessionUser();
    const sql = await getSql();
    const preferShop = data.returnPath.startsWith("/app");
    const shop = await sql<{ stripe_customer_id: string | null }>`
      select stripe_customer_id from companies
      where user_id = ${context.userId} and id <> ${"co_household"}
      limit 1
    `;
    if (preferShop && !shop[0]) {
      throw new Error("Only the shop owner can manage the subscription.");
    }
    const portfolio = await sql<{ stripe_customer_id: string | null }>`
      select stripe_customer_id from portfolios where user_id = ${context.userId} limit 1
    `;
    const customerId = preferShop
      ? shop[0]?.stripe_customer_id || portfolio[0]?.stripe_customer_id
      : portfolio[0]?.stripe_customer_id || shop[0]?.stripe_customer_id;
    const url = await createPortalSessionUrl({
      customerId,
      customerEmail: session?.email,
      returnPath: data.returnPath,
    });
    return { url };
  });
