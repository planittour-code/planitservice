/** Mark portfolio paid and optionally persist Stripe customer/subscription ids. */
export async function markPortfolioPaid(
  userId: string,
  email?: string | null,
  officeName?: string | null,
  stripeIds?: { customerId?: string | null; subscriptionId?: string | null } | null,
) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const customerId = stripeIds?.customerId?.trim() || null;
  const subscriptionId = stripeIds?.subscriptionId?.trim() || null;
  const existing = await sql<{ id: string; paid_at: Date | string | null }>`
    select id, paid_at from portfolios where user_id = ${userId} limit 1
  `;
  if (existing[0]) {
    const wasPaid = Boolean(existing[0].paid_at);
    await sql`
      update portfolios
      set paid_at = coalesce(paid_at, now()),
          stripe_customer_id = coalesce(${customerId}, stripe_customer_id),
          stripe_subscription_id = coalesce(${subscriptionId}, stripe_subscription_id)
      where id = ${existing[0].id}
    `;
    if (!wasPaid) {
      const { trackEvent } = await import("@/lib/housefile/analytics.server");
      await trackEvent({
        name: "portfolio_paid",
        eventKey: `portfolio_paid:${existing[0].id}:${subscriptionId || "grant"}`,
        userId,
        portfolioId: existing[0].id,
      });
    }
    return existing[0].id;
  }
  const id = crypto.randomUUID();
  const local = officeName?.trim() || email?.split("@")[0]?.replace(/[._]/g, " ") || "My portfolio";
  const name = local.replace(/\b\w/g, (c) => c.toUpperCase()) || "My portfolio";
  await sql`
    insert into portfolios (id, user_id, name, paid_at, stripe_customer_id, stripe_subscription_id)
    values (${id}, ${userId}, ${name}, now(), ${customerId}, ${subscriptionId})
  `;
  const { trackEvent } = await import("@/lib/housefile/analytics.server");
  await trackEvent({
    name: "portfolio_paid",
    eventKey: `portfolio_paid:${id}:${subscriptionId || "grant"}`,
    userId,
    portfolioId: id,
  });
  return id;
}

/** Sync portfolios.paid_at (+ stripe ids) from customer.subscription.updated. */
export async function syncPortfolioSubscription(sub: {
  id: string;
  customer: string | { id?: string } | null;
  status: string;
  metadata?: { userId?: string; kind?: string } | null;
}) {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id?.trim() || null;
  const userId = sub.metadata?.userId?.trim() || "";
  const kind = sub.metadata?.kind ?? "";
  const entitled = sub.status === "active" || sub.status === "trialing";
  const revoke =
    sub.status === "canceled" ||
    sub.status === "unpaid" ||
    sub.status === "incomplete_expired";
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();

  const bySub = await sql<{ id: string }>`
    select id from portfolios where stripe_subscription_id = ${sub.id} limit 1
  `;
  if (bySub[0]) {
    if (entitled) {
      const before = await sql<{ paid_at: Date | string | null; user_id: string }>`
        select paid_at, user_id from portfolios where id = ${bySub[0].id} limit 1
      `;
      const wasPaid = Boolean(before[0]?.paid_at);
      await sql`
        update portfolios
        set paid_at = coalesce(paid_at, now()),
            stripe_customer_id = coalesce(${customerId}, stripe_customer_id),
            stripe_subscription_id = ${sub.id}
        where id = ${bySub[0].id}
      `;
      if (!wasPaid) {
        const { trackEvent } = await import("@/lib/housefile/analytics.server");
        await trackEvent({
          name: "portfolio_paid",
          eventKey: `portfolio_paid:${bySub[0].id}:${sub.id}`,
          userId: (before[0]?.user_id ?? userId) || null,
          portfolioId: bySub[0].id,
        });
      }
    } else if (revoke) {
      await sql`
        update portfolios
        set paid_at = null
        where id = ${bySub[0].id}
      `;
    }
    return;
  }

  if (customerId) {
    const byCust = await sql<{ id: string }>`
      select id from portfolios where stripe_customer_id = ${customerId} limit 1
    `;
    if (byCust[0]) {
      if (entitled) {
        const before = await sql<{ paid_at: Date | string | null; user_id: string }>`
          select paid_at, user_id from portfolios where id = ${byCust[0].id} limit 1
        `;
        const wasPaid = Boolean(before[0]?.paid_at);
        await sql`
          update portfolios
          set paid_at = coalesce(paid_at, now()),
              stripe_subscription_id = coalesce(stripe_subscription_id, ${sub.id})
          where id = ${byCust[0].id}
        `;
        if (!wasPaid) {
          const { trackEvent } = await import("@/lib/housefile/analytics.server");
          await trackEvent({
            name: "portfolio_paid",
            eventKey: `portfolio_paid:${byCust[0].id}:${sub.id}`,
            userId: (before[0]?.user_id ?? userId) || null,
            portfolioId: byCust[0].id,
          });
        }
      } else if (revoke) {
        await sql`
          update portfolios
          set paid_at = null
          where id = ${byCust[0].id}
            and (stripe_subscription_id = ${sub.id} or stripe_subscription_id is null)
        `;
      }
      return;
    }
  }

  if (
    userId &&
    entitled &&
    (kind === "manage_monthly" || kind === "manage_annual" || kind === "")
  ) {
    await markPortfolioPaid(userId, null, null, {
      customerId,
      subscriptionId: sub.id,
    });
  }
}

/** Clear entitlement when the Stripe subscription is deleted. */
export async function clearPortfolioSubscription(subscriptionId: string) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await sql`
    update portfolios
    set paid_at = null,
        stripe_subscription_id = null
    where stripe_subscription_id = ${subscriptionId}
  `;
}
