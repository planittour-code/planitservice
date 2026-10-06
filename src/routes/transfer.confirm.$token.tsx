import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PublicHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { confirmPropertyTransfer, getTransferConfirm } from "@/lib/housefile/server";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/transfer/confirm/$token")({
  head: () =>
    pageHead({
      title: "Confirm transfer",
      description: "Confirm that this Property Record should move to the new owner.",
      path: "/transfer/confirm",
    }),
  component: ConfirmTransfer,
});

function ConfirmTransfer() {
  const { token } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["transfer-confirm", token],
    queryFn: () => getTransferConfirm({ data: token }),
  });
  const confirm = useMutation({
    mutationFn: () => confirmPropertyTransfer({ data: { confirmToken: token } }),
    onSuccess: (res) => {
      toast.success(`Transfer confirmed. Waiting on ${res.toEmail}.`);
      if (q.data?.propertyId) {
        void navigate({ to: "/home/$id", params: { id: q.data.propertyId } });
      } else {
        void navigate({ to: "/home" });
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not confirm transfer"),
  });

  const next = `/transfer/confirm/${token}`;

  if (q.isLoading || isPending) {
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
          <h1 className="font-display text-3xl font-medium tracking-tight">Confirm link not found</h1>
          <p className="text-muted-foreground">
            Create the transfer link again from the Property Record. Confirm emails expire in 30 minutes.
          </p>
        </main>
      </div>
    );
  }

  const peek = q.data;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader compact>
        {user ? (
          <UserButton tone="dark" />
        ) : (
          <Button asChild variant="ghost" size="sm">
            <Link to="/login" search={{ next, role: "homeowner" }}>
              Sign in
            </Link>
          </Button>
        )}
      </PublicHeader>
      <main className="mx-auto max-w-md space-y-4 px-5 py-16 text-center">
        <h1 className="font-display text-3xl font-medium tracking-tight">Confirm this transfer</h1>
        <p className="text-muted-foreground">
          Move the Property Record for {peek.address} to {peek.toEmail}. This is the email check on
          Create transfer link.
        </p>
        {peek.confirmed ? (
          <p className="text-sm text-muted-foreground">This transfer is already confirmed.</p>
        ) : peek.expired ? (
          <p className="text-sm text-muted-foreground">
            This confirm email expired. Open the Property Record and create the transfer link again.
          </p>
        ) : !user ? (
          <Button asChild>
            <Link to="/login" search={{ next, role: "homeowner" }}>
              Sign in to confirm
            </Link>
          </Button>
        ) : !peek.isOwner ? (
          <p className="text-sm text-muted-foreground">
            Sign in with the email that owns this Property Record. This link is the second factor.
          </p>
        ) : (
          <Button type="button" onClick={() => confirm.mutate()} disabled={confirm.isPending}>
            {confirm.isPending ? "Confirming…" : "Confirm transfer"}
          </Button>
        )}
      </main>
    </div>
  );
}
