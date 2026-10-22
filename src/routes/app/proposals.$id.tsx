import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ProposalDoc } from "@/components/proposal-doc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkOrderPanel } from "@/components/work-order-panel";
import { approveProposal, deleteProposal, getContractorProposal, listTeam } from "@/lib/housefile/server";

export const Route = createFileRoute("/app/proposals/$id")({ component: ProposalPage });

function ProposalPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["proposal", id],
    queryFn: () => getContractorProposal({ data: id }),
  });
  const team = useQuery({ queryKey: ["team"], queryFn: () => listTeam() });
  const approve = useMutation({
    mutationFn: () => approveProposal({ data: id }),
    onSuccess: (result) => {
      toast.success(
        result.emailed
          ? "Estimate emailed to the homeowner and the office on this File"
          : "Approved. Email did not go out.",
      );
      void q.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not approve"),
  });
  const remove = useMutation({
    mutationFn: () => deleteProposal({ data: id }),
    onSuccess: (result) => {
      toast.success("Estimate deleted");
      void navigate({ to: "/app/properties/$id", params: { id: result.propertyId } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not delete"),
  });
  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (!q.data) return <p className="text-destructive">Proposal not found.</p>;
  const bundle = q.data;
  const owner = team.data?.role === "owner";

  return (
    <div className="space-y-6">
      {bundle.proposal.status === "pending" && (
        <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
          <p className="font-medium">Waiting on the owner</p>
          <p className="text-sm text-muted-foreground">
            A cost was not in materials. The shop Owner is emailed automatically. Approve to send
            this to the homeowner and write the cost into materials.
          </p>
          {owner && (
            <Button
              className="mt-3"
              type="button"
              disabled={approve.isPending}
              onClick={() => approve.mutate()}
            >
              {approve.isPending ? "Sending…" : "Approve and Send Estimate"}
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/properties/$id" params={{ id: bundle.property.id }}>
            Property Record
          </Link>
        </Button>
        {bundle.proposal.status !== "pending" ? (
          <Button asChild variant="outline" size="sm">
            <a href={`/p/${bundle.proposal.share_token}`} target="_blank" rel="noreferrer">
              Customer estimate
            </a>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={remove.isPending}
          onClick={() => {
            if (
              window.confirm(
                "Delete this estimate? Jobs already on the Property Record stay.",
              )
            ) {
              remove.mutate();
            }
          }}
        >
          {remove.isPending ? "Deleting…" : "Delete estimate"}
        </Button>
      </div>
      <WorkOrderPanel
        proposalId={bundle.proposal.id}
        proposalStatus={bundle.proposal.status}
        members={team.data?.members ?? []}
        onChanged={() => q.refetch()}
      />
      <ProposalDoc
        bundle={bundle}
        mode="contractor"
        shopRole={team.data?.role === "owner" ? "owner" : "sales"}
        onChanged={() => q.refetch()}
      />
    </div>
  );
}

