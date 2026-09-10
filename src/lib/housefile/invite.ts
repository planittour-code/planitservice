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

export function managerInviteLetter(input: {
  name: string;
  address: string;
  office: string;
  inviteUrl: string;
}) {
  const greeting = input.name.trim() || "there";
  return `Hi ${greeting},

${input.office} keeps the Property Record for ${input.address}. Photos, jobs, warranties, and issued estimates stay on that file.

Sign in to claim your copy:
${input.inviteUrl}

${input.office} still manages the house. You get the same record.`;
}

export function managerInviteSubject(office: string, address: string) {
  return `${office} invited you to the Property Record for ${address}`;
}

export function namedShopInviteLetter(input: {
  shopName?: string;
  fromName: string;
  address: string;
  title: string;
  body: string;
  quoteUrl: string;
  houseUrl: string;
}) {
  const greeting = input.shopName?.trim() || "there";
  return `Hi ${greeting},

${input.fromName} asked you to quote ${input.title} at ${input.address}.

${input.body}

Open the job and quote from your shop:
${input.quoteUrl}

Property Record (photos and facts at this address):
${input.houseUrl}

PlanitService`;
}

export function namedShopInviteSubject(address: string) {
  return `Quote requested for ${address}`;
}

export function safeNextPath(path: string | undefined, fallback = "/app") {
  if (!path) return fallback;
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) {
    return fallback;
  }
  return path;
}
