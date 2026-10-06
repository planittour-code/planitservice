import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PublicHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { claimPropertyTransfer, getTransferClaim } from "@/lib/housefile/server";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/claim/$token")({
  head: () =>
    pageHead({
      title: "Take this Property Record",
      description: "Accept a transferred Property Record after the current owner confirms by email.",
      path: "/claim",
    }),
  component: ClaimTransfer,
});

function ClaimTransfer() {
  const { token } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["transfer-claim", token],
    queryFn: () => getTransferClaim({ data: token }),
  });
  const claim = useMutation({
    mutationFn: () => claimPropertyTransfer({ data: token }),
    onSuccess: (res) => {
      toast.success("This Property Record is yours now");
      void navigate({ to: "/home/$id", params: { id: res.propertyId } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not claim"),
  });

  const next = `/claim/${token}`;

  if (isPending || q.isLoading) {
    return (
      <div className="min-h-screen bg-background px-5 py-16">
        <Skeleton className="mx-auto h-40 max-w-md" />
      </div>
    );
  }

  if (q.error || !q.data) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader compact>
          <Button asChild variant="ghost" size="sm">
            <Link to="/home">My houses</Link>
          </Button>
        </PublicHeader>
        <main className="mx-auto max-w-md space-y-4 px-5 py-16 text-center">
          <h1 className="font-display text-3xl font-medium tracking-tight">Transfer not found</h1>
          <p className="text-muted-foreground">Ask the current owner to create the transfer link again.</p>
        </main>
      </div>
    );
  }

  const peek = q.data;
  const signedInEmail = peek.signedInEmail?.toLowerCase() ?? user?.primaryEmail?.toLowerCase() ?? "";
  const emailMatch = Boolean(signedInEmail && signedInEmail === peek.toEmail);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader compact>
        {user ? (
          <UserButton tone="dark" />
        ) : (
          <Button asChild variant="ghost" size="sm">
            <Link to="/login" search={{ next, email: peek.toEmail, role: "homeowner" }}>
              Sign in
            </Link>
          </Button>
        )}
      </PublicHeader>
      <main className="mx-auto max-w-md space-y-4 px-5 py-16 text-center">
        <h1 className="font-display text-3xl font-medium tracking-tight">Take this Property Record</h1>
        <p className="text-muted-foreground">
          The jobs, warranties, and maintenance stay with {peek.address}. Sign in as {peek.toEmail} to
          accept.
        </p>
        {peek.status === "accepted" ? (
          <p className="text-sm text-muted-foreground">This Property Record already moved.</p>
        ) : !peek.confirmed ? (
          <p className="text-sm text-muted-foreground">
            The current owner still needs to confirm this transfer from their email.
          </p>
        ) : !user ? (
          <Button asChild>
            <Link to="/login" search={{ next, email: peek.toEmail, role: "homeowner" }}>
              Sign in to accept
            </Link>
          </Button>
        ) : !emailMatch ? (
          <p className="text-sm text-muted-foreground">
            Sign in with {peek.toEmail}. This account is a different email.
          </p>
        ) : (
          <Button type="button" onClick={() => claim.mutate()} disabled={claim.isPending}>
            {claim.isPending ? "Moving the Property Record…" : "Accept the record"}
          </Button>
        )}
      </main>
    </div>
  );
}
