// Import-free so node:test can load it directly.

export type EstimateSendInput = string | { proposalId: string; resend?: boolean; attemptId?: string };

export function parseEstimateSendInput(input: EstimateSendInput): {
  proposalId: string;
  resend: boolean;
  attemptId: string | null;
} {
  if (typeof input === "string") return { proposalId: input, resend: false, attemptId: null };
  if (!input || typeof input.proposalId !== "string" || !input.proposalId) {
    throw new Error("Proposal not found");
  }
  const attemptId = typeof input.attemptId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(input.attemptId)
    ? input.attemptId
    : null;
  return { proposalId: input.proposalId, resend: input.resend === true, attemptId };
}

/** Throws a user-facing message when this proposal can't be emailed right now. */
export function assertEstimateSendable(status: string, resend: boolean) {
  if (status === "pending") {
    throw new Error("The owner has to approve this quote before it can go to the homeowner.");
  }
  if (status === "sent" && !resend) {
    throw new Error("This estimate was already sent. Use Re-send estimate to send it again.");
  }
}

export function estimateIdempotencyScope(proposalId: string) {
  return `estimate/${proposalId}`;
}
