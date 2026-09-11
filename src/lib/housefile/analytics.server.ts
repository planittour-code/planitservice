/** Minimal Portfolio funnel analytics — ids only, no PII beyond stored ids.
 *
 * Call sites:
 * - portfolio_signup_started → createCheckoutSessionUrl (manage_* kinds)
 * - portfolio_paid → markPortfolioPaid + syncPortfolioSubscription (null→paid)
 * - address_mapped → DB trigger on portfolio_properties insert (addPortfolioProperty)
 * - quote_created → DB trigger on proposals insert (createProposalFromWizard)
 */

export type AnalyticsEventName =
  | "portfolio_signup_started"
  | "portfolio_paid"
  | "address_mapped"
  | "quote_created";

export type TrackEventInput = {
  name: AnalyticsEventName;
  /** Idempotency key — insert once; refresh/webhook replay is a no-op. */
  eventKey: string;
  userId?: string | null;
  sessionId?: string | null;
  portfolioId?: string | null;
  propertyId?: string | null;
  quoteId?: string | null;
};

/**
 * Insert one analytics row. Never throws to callers — failures fall back to a
 * structured console JSON line so product still has a signal.
 */
export async function trackEvent(input: TrackEventInput): Promise<void> {
  const payload = {
    type: "analytics_event" as const,
    name: input.name,
    event_key: input.eventKey,
    user_id: input.userId?.trim() || null,
    session_id: input.sessionId?.trim() || null,
    portfolio_id: input.portfolioId?.trim() || null,
    property_id: input.propertyId?.trim() || null,
    quote_id: input.quoteId?.trim() || null,
  };
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      insert into analytics_events (
        id, name, user_id, session_id, portfolio_id, property_id, quote_id, event_key
      ) values (
        ${crypto.randomUUID()},
        ${payload.name},
        ${payload.user_id},
        ${payload.session_id},
        ${payload.portfolio_id},
        ${payload.property_id},
        ${payload.quote_id},
        ${payload.event_key}
      )
      on conflict (event_key) do nothing
    `;
  } catch (err) {
    console.log(
      JSON.stringify({
        ...payload,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
