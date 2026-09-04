import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalShell, SaasContent } from "@/components/legal-doc";
import { LEGAL_NAME, LEGAL_SITE } from "@/lib/legal";

export const Route = createFileRoute("/saas")({
  head: () => ({
    meta: [{ title: `SaaS Agreement — ${LEGAL_NAME}` }],
  }),
  component: SaasPage,
});

function SaasPage() {
  return (
    <LegalShell kicker="Subscription" title="Software as a Service Agreement">
      <p className="rounded-xl bg-card px-4 py-3 text-sm shadow-[var(--shadow-border)]">
        This SaaS Agreement is Exhibit B to the{" "}
        <Link to="/terms" hash="saas" className="underline underline-offset-2">
          {LEGAL_NAME} Terms of Service
        </Link>
        . Using {LEGAL_SITE} on a paid or trial plan accepts the Terms, this SaaS Agreement, the{" "}
        <Link to="/aup" className="underline underline-offset-2">
          AUP
        </Link>
        , and the{" "}
        <Link to="/sla" className="underline underline-offset-2">
          SLA
        </Link>
        .
      </p>
      <SaasContent />
    </LegalShell>
  );
}
