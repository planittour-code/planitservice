import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalSection, LegalShell } from "@/components/legal-doc";
import { LEGAL_EMAIL, LEGAL_GOVERNING, LEGAL_NAME, LEGAL_SITE, LEGAL_SUPPORT_HOURS } from "@/lib/legal";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  head: () =>
    pageHead({
      title: "Privacy Policy",
      description: `How ${LEGAL_NAME} collects, uses, and stores account, Property Record, and shop data.`,
      path: "/privacy",
    }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalShell kicker={LEGAL_NAME} title="Privacy Policy">
      <p>
        This Privacy Policy describes how {LEGAL_NAME} handles information when you use the cloud
        software at {LEGAL_SITE}. It covers accounts, Property Records, shop materials, estimates,
        and billing. Questions: {LEGAL_EMAIL}. Support hours are {LEGAL_SUPPORT_HOURS}.
      </p>

      <LegalSection id="collect" n="1" title="What we collect">
        <p>
          Account data you give us: name, email, password (stored hashed), and the role you choose
          (homeowner, shop, or property manager). Shop data: company name, address, phone, logos,
          materials, templates, and team seat emails. Property Record data: address, photos, jobs,
          products, warranties, notes, and known shops. Billing is processed by Stripe. We do not
          collect payment card numbers on our pages.
        </p>
        <p>
          We also store technical logs needed to run the Service: signed-in session, product events
          (for example that a signup started), and support emails you send us. Product analytics
          use ids, not the contents of a house file.
        </p>
      </LegalSection>

      <LegalSection id="use" n="2" title="How we use it">
        <p>
          We use this information to operate the Service: sign you in, keep the Property Record at
          the address, send estimates, process subscriptions, and reply to support. We may use
          aggregated, de-identified counts to understand which public pages convert. We do not sell
          Property Records or shop materials.
        </p>
      </LegalSection>

      <LegalSection id="share" n="3" title="Who sees it">
        <p>
          A shop sees a house when invited, paid, or otherwise authorized by the product rules. A
          homeowner sees the shops and estimates on that Property Record. Processors we use include
          Stripe (billing), map and address lookup providers, and email delivery. Their terms apply
          to their part of the stack.
        </p>
      </LegalSection>

      <LegalSection id="keep" n="4" title="How long we keep it">
        <p>
          While the account is active we keep the records you entered. After cancellation we keep
          paid-account data for 30 days, then delete or irreversibly anonymize it, except records we
          must keep for tax, fraud, or law. On written request from an account owner we will export
          content in a reasonable machine-readable form within 15 business days, as described in the{" "}
          <Link to="/sla" className="underline underline-offset-2">
            SLA
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="rights" n="5" title="Your choices">
        <p>
          You can update profile and shop details in the account. You can cancel in the Stripe
          customer portal. Email {LEGAL_EMAIL} to request an export or deletion. Do not store
          protected health information, payment card PAN data, or government ID numbers except as a
          product field already asks.
        </p>
      </LegalSection>

      <LegalSection id="law" n="6" title="Governing law">
        <p>
          This policy is governed by {LEGAL_GOVERNING}. The{" "}
          <Link to="/terms" className="underline underline-offset-2">
            Terms of Service
          </Link>{" "}
          remain the agreement for use of the Service.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
