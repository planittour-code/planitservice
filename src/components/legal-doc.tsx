import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AuthSlot, PageFooter, PublicHeader } from "@/components/site-chrome";
import {
  LEGAL_EFFECTIVE,
  LEGAL_EMAIL,
  LEGAL_GOVERNING,
  LEGAL_NAME,
  LEGAL_SITE,
  UPTIME_TARGET,
} from "@/lib/legal";

export function LegalShell({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader path="choose">
        <AuthSlot signedInTo="/home" />
      </PublicHeader>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-5 sm:py-16">
        <p className="text-sm tracking-wide text-muted-foreground uppercase">{kicker}</p>
        <h1 className="mt-2 font-display text-4xl font-medium tracking-tight md:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Effective {LEGAL_EFFECTIVE}</p>
        <div className="mt-10 space-y-10 text-[1.05rem] leading-relaxed">{children}</div>
      </main>
      <PageFooter />
    </div>
  );
}

export function LegalSection({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="font-display text-2xl font-medium tracking-tight">
        <span className="mr-2 text-muted-foreground tabular-nums">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function TermsAgree({ id = "agree-terms" }: { id?: string }) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
      <input
        id={id}
        name="agree"
        type="checkbox"
        required
        className="mt-1 size-4 shrink-0"
      />
      <span>
        I agree to the{" "}
        <Link to="/terms" className="underline underline-offset-2 hover:text-foreground">
          Terms of Service
        </Link>
        , including the{" "}
        <Link to="/saas" className="underline underline-offset-2 hover:text-foreground">
          SaaS Agreement
        </Link>
        ,{" "}
        <Link to="/aup" className="underline underline-offset-2 hover:text-foreground">
          Acceptable Use Policy
        </Link>
        , and{" "}
        <Link to="/sla" className="underline underline-offset-2 hover:text-foreground">
          Service Level Agreement
        </Link>
        .
      </span>
    </label>
  );
}

export function SlaContent() {
  return (
    <>
      <p>
        This Service Level Agreement (“SLA”) is part of the{" "}
        <Link to="/terms" className="underline underline-offset-2">
          {LEGAL_NAME} Terms of Service
        </Link>
        . If this SLA and the Terms conflict on availability, credits, or support response, this SLA
        controls. Capitalized terms not defined here have the meaning in the Terms.
      </p>

      <LegalSection id="sla-scope" n="1" title="Covered service">
        <p>
          This SLA covers the production {LEGAL_NAME} cloud application at {LEGAL_SITE}: sign-in,
          Property Records, shop quoting, materials, estimates, and billing screens we host. It
          applies only to paid subscriptions in good standing (homeowner Standard or Pro per
          property, shop plans, and paid extra seats).
        </p>
        <p>
          It does not cover free trials, unpaid or past-due accounts, sample or demo houses, beta
          features marked as preview, or anything you host yourself.
        </p>
      </LegalSection>

      <LegalSection id="sla-uptime" n="2" title="Monthly uptime commitment">
        <p>
          We will make the Covered Service Available at least {UPTIME_TARGET} of each calendar month,
          excluding Permitted Downtime.
        </p>
        <p>
          <strong className="font-medium text-foreground">Available</strong> means a paying user can
          authenticate and load the shop dashboard or a Property Record they are authorized to see,
          from our production edge, for a continuous five-minute window.
        </p>
        <p>
          <strong className="font-medium text-foreground">Downtime</strong> is any period of five or
          more consecutive minutes when the Covered Service is not Available because of a failure in
          systems we control.
        </p>
        <p>
          <strong className="font-medium text-foreground">Monthly Uptime Percentage</strong> = (total
          minutes in the month − Permitted Downtime − Downtime) ÷ (total minutes in the month −
          Permitted Downtime) × 100.
        </p>
      </LegalSection>

      <LegalSection id="sla-credits" n="3" title="Service credits">
        <p>
          If Monthly Uptime Percentage falls below {UPTIME_TARGET} in a month, you may request a
          service credit against the subscription fees you actually paid us for that month
          (excluding taxes, Stripe fees, and one-time charges):
        </p>
        <div className="overflow-x-auto rounded-xl bg-card shadow-[var(--shadow-border)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-4 py-3 font-medium">Monthly Uptime Percentage</th>
                <th className="px-4 py-3 font-medium">Credit</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="px-4 py-3">Less than 99.9% and at least 99.0%</td>
                <td className="px-4 py-3">10% of that month’s paid fees</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-4 py-3">Less than 99.0% and at least 95.0%</td>
                <td className="px-4 py-3">25% of that month’s paid fees</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Less than 95.0%</td>
                <td className="px-4 py-3">50% of that month’s paid fees</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Credits are the sole and exclusive remedy for missed uptime. They are not cash, not
          transferable, and apply only to a future {LEGAL_NAME} invoice. The credit for a month
          cannot exceed 50% of the fees you paid us for that month. Unused credits expire if the
          account is closed.
        </p>
      </LegalSection>

      <LegalSection id="sla-claim" n="4" title="How to claim a credit">
        <p>
          Email {LEGAL_EMAIL} within 30 days after the month ends. Include the account email, the
          affected plan (shop or Property Record), UTC start and end of each Downtime period, and
          how you observed it. We may ask for request IDs or screenshots.
        </p>
        <p>
          We will confirm or explain the measurement within 10 business days. Approved credits
          appear on the next billing cycle after we verify the incident.
        </p>
      </LegalSection>

      <LegalSection id="sla-maintenance" n="5" title="Permitted Downtime">
        <p>The following do not count against Monthly Uptime Percentage:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Scheduled maintenance, if we post notice at least 72 hours ahead. We aim for Sundays
            1:00 a.m.–5:00 a.m. US Eastern, and no more than four hours in a calendar month.
          </li>
          <li>Emergency maintenance needed to stop data loss, a security incident, or cascading failure.</li>
          <li>Failures of your network, device, browser, or credentials.</li>
          <li>
            Failures of third parties we do not operate: Stripe, map and geocoding providers, email
            delivery, the Grok auth broker, xAI, or your materials suppliers.
          </li>
          <li>Force majeure: war, flood, fire, epidemic, grid or backbone outage, or government order.</li>
          <li>Suspension for non-payment, abuse, or a lawful demand to take content down.</li>
          <li>Features you asked us to disable, or traffic far beyond your plan after we warned you.</li>
        </ul>
      </LegalSection>

      <LegalSection id="sla-support" n="6" title="Support response">
        <p>
          Paid accounts may email {LEGAL_EMAIL}. Business hours are Monday–Friday, 9:00 a.m. to 6:00
          p.m. US Eastern, excluding US federal holidays. We target first response as follows:
        </p>
        <div className="overflow-x-auto rounded-xl bg-card shadow-[var(--shadow-border)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">Meaning</th>
                <th className="px-4 py-3 font-medium">First response</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="px-4 py-3">P1</td>
                <td className="px-4 py-3">Covered Service is down for all users on your account</td>
                <td className="px-4 py-3">4 business hours</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-4 py-3">P2</td>
                <td className="px-4 py-3">A core feature (quote, Property Record, billing) is unusable</td>
                <td className="px-4 py-3">1 business day</td>
              </tr>
              <tr>
                <td className="px-4 py-3">P3</td>
                <td className="px-4 py-3">Questions, copy, and non-blocking defects</td>
                <td className="px-4 py-3">2 business days</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Response is an acknowledgment with an owner, not a finished fix. P1 and P2 are worked
          until the service is Available or we have a documented workaround.
        </p>
      </LegalSection>

      <LegalSection id="sla-data" n="7" title="Data durability">
        <p>
          We take a backup of production Property Record and shop data at least once every 24 hours.
          Recovery point objective is 24 hours. Recovery time objective for a region-level restore
          we control is 8 hours after we declare a disaster, excluding Permitted Downtime.
        </p>
        <p>
          You own the content you put in a Property Record and in your shop materials. On written
          request from an account owner, we will export that content in a reasonable machine-readable
          form within 15 business days, while the account is in good standing or within 30 days after
          cancellation.
        </p>
        <p>
          After cancellation we keep paid-account data for 30 days, then delete or irreversibly
          anonymize it, except records we must keep for tax, fraud, or law.
        </p>
      </LegalSection>

      <LegalSection id="sla-security" n="8" title="Security commitments">
        <ul className="list-disc space-y-2 pl-5">
          <li>TLS for traffic between your browser and our production edge.</li>
          <li>Authenticated sessions for shop and homeowner accounts. We do not sell your Property Record.</li>
          <li>Customer data is scoped to the account that owns it. Shops see a house only when invited, paid, or otherwise authorized by the product rules.</li>
          <li>We will notify the account email of a confirmed unauthorized access to your content without undue delay, and in any case as required by law.</li>
        </ul>
        <p>
          {LEGAL_NAME} is not a HIPAA business associate unless we sign a separate BAA. Do not store
          protected health information here.
        </p>
      </LegalSection>

      <LegalSection id="sla-limits" n="9" title="Limits">
        <p>
          This SLA is not a warranty that every quote, measurement, or product cost is correct.
          Estimates are written by the shop. We do not guarantee workmanship of any contractor.
        </p>
        <p>
          Credits are your exclusive remedy for our failure to meet this SLA. Nothing here expands
          the limitation of liability in the Terms. Governing law remains {LEGAL_GOVERNING}.
        </p>
      </LegalSection>
    </>
  );
}

export function SaasContent() {
  return (
    <>
      <p>
        This Software as a Service Agreement (“SaaS Agreement”) is part of the{" "}
        <Link to="/terms" className="underline underline-offset-2">
          {LEGAL_NAME} Terms of Service
        </Link>
        . It is the commercial subscription contract for the hosted Service. If this SaaS Agreement
        and the Terms conflict on license, term, seats, or subscription fees, this SaaS Agreement
        controls. The{" "}
        <Link to="/sla" className="underline underline-offset-2">
          SLA
        </Link>{" "}
        controls availability and credits. The{" "}
        <Link to="/aup" className="underline underline-offset-2">
          AUP
        </Link>{" "}
        controls acceptable use.
      </p>

      <LegalSection id="saas-grant" n="1" title="Subscription grant">
        <p>
          Subject to these Terms, payment of fees, and the AUP, {LEGAL_NAME} grants you a limited,
          non-exclusive, non-transferable, non-sublicensable right to access and use the Service
          during the subscription term, solely for your internal business (shop) or household
          (Property Record) purposes.
        </p>
        <p>
          We retain all right, title, and interest in the Service, including software, templates,
          starter materials catalogs, documentation, and branding. You do not receive a copy of the
          source code, a perpetual license, or any right to run the Service on your own servers.
        </p>
      </LegalSection>

      <LegalSection id="saas-users" n="2" title="Authorized users">
        <p>
          Shop plans include the owner seat. Extra seats you purchase may be used only by people in
          your shop who quote or administer the account. Homeowner plans are billed per Property
          Record; household members you invite share that record, they do not get a second shop.
        </p>
        <p>
          You will not share logins to avoid a seat fee, exceed purchased seats, or let a competitor
          use your account to copy materials or Property Records. You are responsible for each
          Authorized User’s compliance with this SaaS Agreement and the AUP.
        </p>
      </LegalSection>

      <LegalSection id="saas-our" n="3" title="Our obligations">
        <ul className="list-disc space-y-2 pl-5">
          <li>Host and operate the production Service at {LEGAL_SITE}.</li>
          <li>Meet the uptime, support, backup, and security commitments in the SLA.</li>
          <li>Provide the features included in the plan you pay for, as they exist from time to time.</li>
          <li>Process subscription charges through Stripe as described in the Terms.</li>
        </ul>
        <p>
          We may change non-material features, move infrastructure, and apply security patches
          without a new order. If we drop a material paid feature, we will give reasonable notice
          or a comparable substitute.
        </p>
      </LegalSection>

      <LegalSection id="saas-your" n="4" title="Your obligations">
        <ul className="list-disc space-y-2 pl-5">
          <li>Use the Service only as permitted in this SaaS Agreement and the AUP.</li>
          <li>Keep account credentials secret and revoke seats that leave the shop.</li>
          <li>Enter content you have the right to use. Materials costs and estimates are yours.</li>
          <li>Maintain your own devices, browsers, and internet access.</li>
          <li>Pay fees when due. Configure Stripe with a valid payment method.</li>
        </ul>
      </LegalSection>

      <LegalSection id="saas-term" n="5" title="Term, renewal, and termination">
        <p>
          The subscription starts when payment succeeds and continues month to month or year to year
          as you selected, renewing automatically until you cancel in the billing portal. Canceling
          stops the next renewal; you keep access through the paid period.
        </p>
        <p>
          Either party may terminate for a material breach that remains uncured 15 days after
          written notice to {LEGAL_EMAIL} (or to your account email). We may suspend immediately for
          non-payment, AUP violation, or a security risk. On termination, the license ends. Data
          export and deletion follow the SLA.
        </p>
      </LegalSection>

      <LegalSection id="saas-confidential" n="6" title="Confidentiality">
        <p>
          Each party will not disclose the other’s non-public information—shop materials costs,
          Property Record contents, pricing we quote you, and security details—except to personnel
          and processors who need it to perform this agreement, or as required by law. This duty
          lasts three years after the subscription ends, and longer for trade secrets while they
          remain secret.
        </p>
      </LegalSection>

      <LegalSection id="saas-order" n="7" title="Order of documents">
        <p>
          If documents conflict: (1) a written order or Stripe plan you purchased, (2) this SaaS
          Agreement, (3) the SLA, (4) the AUP, (5) the remaining Terms. Governing law remains{" "}
          {LEGAL_GOVERNING}.
        </p>
      </LegalSection>
    </>
  );
}

export function AupContent() {
  return (
    <>
      <p>
        This Acceptable Use Policy (“AUP”) is part of the{" "}
        <Link to="/terms" className="underline underline-offset-2">
          {LEGAL_NAME} Terms of Service
        </Link>
        . It applies to every account, seat, Property Record, estimate, and API or export we make
        available. We may suspend or close an account that violates it.
      </p>

      <LegalSection id="aup-ok" n="1" title="Permitted use">
        <p>
          Use the Service to keep a Property Record for a house you are authorized to document, to
          quote work from your shop’s materials, and to send and accept estimates with the people
          who belong on that job. Use only the seats and properties you pay for.
        </p>
      </LegalSection>

      <LegalSection id="aup-no" n="2" title="Prohibited conduct">
        <p>You will not, and will not allow anyone using your account to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Break the law, or use the Service to further fraud, theft, or unlicensed contracting.</li>
          <li>Upload content you do not have the right to store or share, including photos of people who have not agreed where consent is required.</li>
          <li>Infringe copyright, trademark, or trade secret, or impersonate another shop or homeowner.</li>
          <li>Store protected health information, payment card PAN data, or government ID numbers except as a product field already asks (for example a name on an estimate).</li>
          <li>Probe, scan, scrape, or load-test the Service, or bypass authentication, seats, or paywalls.</li>
          <li>Introduce malware, or attempt to access another customer’s shop, materials, or Property Record.</li>
          <li>Harvest addresses, emails, or phone numbers from the Service to spam or resell lists.</li>
          <li>Open a shop or homeowner account solely to copy another shop’s materials, templates, or book.</li>
          <li>Resell, white-label, or timeshare the Service without a written agreement with us.</li>
          <li>Interfere with billing, Stripe, or usage metering, or share one login across a crew to avoid seat fees.</li>
          <li>Use the Service to publish threats, harassment, or unlawful discrimination in an estimate, RFP, or Property Record note.</li>
          <li>Reverse engineer the Service except to the extent the law will not allow this limit.</li>
        </ul>
      </LegalSection>

      <LegalSection id="aup-content" n="3" title="Content and jobs">
        <p>
          Estimates, costs, and warranties are the shop’s representations to the homeowner, not
          ours. Do not post fake jobs, fake reviews, or a Property Record for an address you have
          no right to document. Do not use a sample or Maple demo house as if it were a paying
          customer’s job.
        </p>
      </LegalSection>

      <LegalSection id="aup-enforce" n="4" title="Enforcement">
        <p>
          We may investigate reports, remove content, limit features, suspend seats, or close the
          account. We will try to notify the account email unless the law or a security incident
          forbids it. Repeat or severe violations may be terminated without a prior warning.
        </p>
        <p>
          Fees already paid are not refunded when we terminate for AUP breach, except where the law
          requires it. We may report unlawful activity to authorities.
        </p>
      </LegalSection>

      <LegalSection id="aup-report" n="5" title="Reporting">
        <p>
          Report abuse, suspected unauthorized access, or AUP violations to {LEGAL_EMAIL} with the
          account, URL or token, and what you saw. We target a first response within two business
          days for AUP reports that are not a P1 outage (those follow the SLA).
        </p>
      </LegalSection>
    </>
  );
}
