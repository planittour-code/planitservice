import { createFileRoute, Link } from "@tanstack/react-router";
import { AupContent, LegalSection, LegalShell, SaasContent, SlaContent } from "@/components/legal-doc";
import {
  LEGAL_EMAIL,
  LEGAL_GOVERNING,
  LEGAL_NAME,
  LEGAL_SITE,
} from "@/lib/legal";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [{ title: `Terms of Service — ${LEGAL_NAME}` }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalShell kicker={LEGAL_NAME} title="Terms of Service">
      <p>
        These Terms of Service (“Terms”) are the agreement between you and {LEGAL_NAME} for the
        cloud software at {LEGAL_SITE} (the “Service”). By creating an account, paying for a plan,
        or using the Service, you agree to these Terms and to the exhibits that are part of them:
        the{" "}
        <Link to="/saas" className="underline underline-offset-2">
          SaaS Agreement
        </Link>
        , the{" "}
        <Link to="/aup" className="underline underline-offset-2">
          Acceptable Use Policy
        </Link>
        , and the{" "}
        <Link to="/sla" className="underline underline-offset-2">
          Service Level Agreement
        </Link>
        .
      </p>
      <nav className="rounded-xl bg-card px-4 py-4 text-sm shadow-[var(--shadow-border)]" aria-label="On this page">
        <ul className="grid gap-2 sm:grid-cols-2">
          <li>
            <a href="#agreement" className="hover:text-foreground">
              1. The agreement
            </a>
          </li>
          <li>
            <a href="#service" className="hover:text-foreground">
              2. The Service
            </a>
          </li>
          <li>
            <a href="#accounts" className="hover:text-foreground">
              3. Accounts
            </a>
          </li>
          <li>
            <a href="#billing" className="hover:text-foreground">
              4. Plans and billing
            </a>
          </li>
          <li>
            <a href="#content" className="hover:text-foreground">
              5. Your content
            </a>
          </li>
          <li>
            <a href="#estimates" className="hover:text-foreground">
              6. Estimates and jobs
            </a>
          </li>
          <li>
            <a href="#saas" className="hover:text-foreground">
              7. SaaS Agreement
            </a>
          </li>
          <li>
            <a href="#aup" className="hover:text-foreground">
              8. Acceptable Use Policy
            </a>
          </li>
          <li>
            <a href="#third" className="hover:text-foreground">
              9. Third parties
            </a>
          </li>
          <li>
            <a href="#sla" className="hover:text-foreground">
              10. Service Level Agreement
            </a>
          </li>
          <li>
            <a href="#disclaimers" className="hover:text-foreground">
              11. Disclaimers
            </a>
          </li>
          <li>
            <a href="#liability" className="hover:text-foreground">
              12. Liability
            </a>
          </li>
          <li>
            <a href="#end" className="hover:text-foreground">
              13. Ending the Service
            </a>
          </li>
        </ul>
      </nav>

      <LegalSection id="agreement" n="1" title="The agreement">
        <p>
          If you use the Service for a shop, you represent that you can bind that business. If you
          use it for a house, you represent that you are the owner, occupant, or agent authorized to
          keep a Property Record for that address. You must be at least 18 years old.
        </p>
        <p>
          We may update these Terms. Material changes will be posted on this page with a new
          effective date. Continued use after that date is acceptance. If you do not agree, stop
          using the Service and cancel in billing.
        </p>
      </LegalSection>

      <LegalSection id="service" n="2" title="The Service">
        <p>
          {LEGAL_NAME} is software. Homeowners keep a Property Record at an address—jobs, products,
          warranties, photos, and maintenance. Contractors look up an address, quote from materials,
          and send an estimate. We host the application, store the records you enter, and process
          subscription payments.
        </p>
        <p>
          We are not a general contractor, broker, insurer, or escrow. We do not perform the work on
          the house. A quote on {LEGAL_NAME} is between the shop and the homeowner.
        </p>
      </LegalSection>

      <LegalSection id="accounts" n="3" title="Accounts">
        <p>
          Keep your email and password accurate and secret. You are responsible for activity under
          your account, including extra shop seats you invite. Tell us promptly at {LEGAL_EMAIL} if
          you believe the account was used without permission.
        </p>
        <p>
          Shop owners control materials, team seats, and billing for the shop. Homeowners control
          the Property Records on their account. Do not share a login to dodge a seat or a per-property
          fee.
        </p>
      </LegalSection>

      <LegalSection id="billing" n="4" title="Plans and billing">
        <p>
          Prices are shown at signup and in the account. Shop plans are billed per shop, with extra
          seats billed separately. Homeowner plans are billed per Property Record. Annual plans are
          prepaid for the year.
        </p>
        <p>
          Payment is processed by Stripe. By paying, you authorize recurring charges until you
          cancel. Cancel anytime in the Stripe customer portal or from shop or homeowner billing.
          Access continues through the paid period. We do not prorate a month already started unless
          the law requires it or we issued an SLA credit.
        </p>
        <p>
          Failed payment may suspend the account until the invoice is paid. Fees are in US dollars
          and exclude taxes we must collect.
        </p>
      </LegalSection>

      <LegalSection id="content" n="5" title="Your content">
        <p>
          You keep ownership of photos, measurements, materials costs, and notes you upload. You
          grant {LEGAL_NAME} a limited license to host, display, back up, and transmit that content
          so the Service can run—including sharing a Property Record or estimate with the people you
          choose.
        </p>
        <p>
          You represent that you have the right to upload the content and that it is not unlawful.
          We may remove content that violates these Terms or the law. The house’s history is meant
          to stay with the address; transfers follow the product’s claim flow.
        </p>
      </LegalSection>

      <LegalSection id="estimates" n="6" title="Estimates and jobs">
        <p>
          Line items, costs, sell prices, and warranties on an estimate are the shop’s. {LEGAL_NAME}
          does not warrant that a measurement, product, or price is complete or that the job will be
          done. Homeowners should read each line before they accept. Starting work is a matter
          between the shop and the homeowner, not a {LEGAL_NAME} obligation.
        </p>
      </LegalSection>

      <LegalSection id="saas" n="7" title="SaaS Agreement">
        <p>
          Paid and trial access is a hosted software subscription. The SaaS Agreement (Exhibit B),
          also published at{" "}
          <Link to="/saas" className="underline underline-offset-2">
            {LEGAL_SITE}/saas
          </Link>
          , is the license, seat, term, and confidentiality contract.
        </p>
      </LegalSection>

      <LegalSection id="aup" n="8" title="Acceptable Use Policy">
        <p>
          You must use the Service as described in the AUP (Exhibit C), also published at{" "}
          <Link to="/aup" className="underline underline-offset-2">
            {LEGAL_SITE}/aup
          </Link>
          . We may suspend or close an account that violates it.
        </p>
      </LegalSection>

      <LegalSection id="third" n="9" title="Third parties">
        <p>
          The Service uses processors we do not control, including Stripe for payment, map and
          address lookup providers, and (when enabled) model providers for reading house photos.
          Their terms apply to their part of the stack. An outage on their side is excluded from the
          SLA except as that SLA already says.
        </p>
      </LegalSection>

      <LegalSection id="sla" n="10" title="Service Level Agreement">
        <p>
          Paid accounts are covered by the cloud SLA (Exhibit A), also published at{" "}
          <Link to="/sla" className="underline underline-offset-2">
            {LEGAL_SITE}/sla
          </Link>
          . Service credits described there are the exclusive remedy for missed uptime.
        </p>
      </LegalSection>

      <div className="space-y-10 border-t border-border pt-10">
        <h2 className="font-display text-3xl font-medium tracking-tight">Exhibit A — Service Level Agreement</h2>
        <SlaContent />
      </div>

      <div className="space-y-10 border-t border-border pt-10">
        <h2 className="font-display text-3xl font-medium tracking-tight">
          Exhibit B — Software as a Service Agreement
        </h2>
        <SaasContent />
      </div>

      <div className="space-y-10 border-t border-border pt-10">
        <h2 className="font-display text-3xl font-medium tracking-tight">
          Exhibit C — Acceptable Use Policy
        </h2>
        <AupContent />
      </div>

      <LegalSection id="disclaimers" n="11" title="Disclaimers">
        <p>
          THE SERVICE IS PROVIDED “AS IS.” EXCEPT FOR THE SLA, {LEGAL_NAME.toUpperCase()} DISCLAIMS
          ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE, AND NON-INFRINGEMENT. We do not warrant uninterrupted access except as the SLA
          requires, or that stored content will meet a lender, inspector, or buyer’s needs.
        </p>
      </LegalSection>

      <LegalSection id="liability" n="12" title="Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT THE LAW ALLOWS, {LEGAL_NAME.toUpperCase()} IS NOT LIABLE FOR INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, LOST JOBS, OR
          COST OF COVER, EVEN IF WE WERE TOLD THEY WERE POSSIBLE.
        </p>
        <p>
          OUR TOTAL LIABILITY FOR A CLAIM RELATING TO THE SERVICE IS CAPPED AT THE FEES YOU PAID US
          FOR THE SERVICE IN THE TWELVE MONTHS BEFORE THE CLAIM. SLA credits count toward that cap.
          Some states do not allow certain limits; in those states our liability is limited to the
          fullest extent permitted.
        </p>
        <p>
          You will defend and indemnify {LEGAL_NAME} against claims arising from your content, your
          job-site work, or your misuse of the Service, except to the extent we caused the claim.
        </p>
      </LegalSection>

      <LegalSection id="end" n="13" title="Ending the Service">
        <p>
          You may cancel in billing at any time. We may suspend or close an account for non-payment,
          a material breach, an AUP violation, or a legal demand. After closure, Section 5 (license
          only as needed to wind down), 11, 12, 13, the SaaS confidentiality term, and SLA credits
          that already accrued still apply.
        </p>
        <p>
          These Terms are governed by {LEGAL_GOVERNING}, without regard to conflict-of-law rules.
          Courts in Cobb County, Georgia have exclusive venue, except that we may seek injunctive
          relief anywhere to protect the Service or customer data.
        </p>
        <p>
          Questions: {LEGAL_EMAIL}. {LEGAL_NAME} operates {LEGAL_SITE}.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
