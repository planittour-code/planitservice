export function invitationLetter(input: {
  name: string;
  address: string;
  company: string;
  inviteUrl: string;
  proposalUrl?: string;
}) {
  const proposal = input.proposalUrl
    ? `\nThe first draft of the proposal:\n${input.proposalUrl}\n`
    : "";
  return `Hi ${input.name},

I opened a house account for ${input.address} and started a first draft.

Your property record — jobs, photos, paint colors, and warranties:
${input.inviteUrl}
${proposal}
You can revise the draft, add photos, and fill in the missing house data so the next quote is easier.

${input.company}`;
}

export function invitationSubject(company: string, address: string) {
  return `${company} sent an estimate for ${address}`;
}

export function safeNextPath(path: string | undefined, fallback = "/app") {
  if (!path) return fallback;
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) {
    return fallback;
  }
  return path;
}
