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
        </Link>{" "}
        and the{" "}
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
