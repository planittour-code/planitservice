import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalShell, SlaContent } from "@/components/legal-doc";
import { LEGAL_NAME, LEGAL_SITE } from "@/lib/legal";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/sla")({
  head: () =>
    pageHead({
      title: "Service Level Agreement",
      description: `${LEGAL_NAME} cloud uptime, credits, backups, and support response times.`,
      path: "/sla",
    }),
  component: SlaPage,
});

function SlaPage() {
  return (
    <LegalShell kicker="Cloud service" title="Service Level Agreement">
      <p className="rounded-xl bg-card px-4 py-3 text-sm shadow-[var(--shadow-border)]">
        This SLA is Exhibit A to the{" "}
        <Link to="/terms" hash="sla" className="underline underline-offset-2">
          {LEGAL_NAME} Terms of Service
        </Link>
        . Using {LEGAL_SITE} on a paid plan accepts both documents.
      </p>
      <SlaContent />
    </LegalShell>
  );
}
