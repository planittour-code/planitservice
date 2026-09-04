import { createFileRoute, Link } from "@tanstack/react-router";
import { AupContent, LegalShell } from "@/components/legal-doc";
import { LEGAL_NAME, LEGAL_SITE } from "@/lib/legal";

export const Route = createFileRoute("/aup")({
  head: () => ({
    meta: [{ title: `Acceptable Use Policy — ${LEGAL_NAME}` }],
  }),
  component: AupPage,
});

function AupPage() {
  return (
    <LegalShell kicker="Use policy" title="Acceptable Use Policy">
      <p className="rounded-xl bg-card px-4 py-3 text-sm shadow-[var(--shadow-border)]">
        This AUP is Exhibit C to the{" "}
        <Link to="/terms" hash="aup" className="underline underline-offset-2">
          {LEGAL_NAME} Terms of Service
        </Link>
        . Using {LEGAL_SITE} accepts the Terms, the{" "}
        <Link to="/saas" className="underline underline-offset-2">
          SaaS Agreement
        </Link>
        , this AUP, and the{" "}
        <Link to="/sla" className="underline underline-offset-2">
          SLA
        </Link>
        .
      </p>
      <AupContent />
    </LegalShell>
  );
}
