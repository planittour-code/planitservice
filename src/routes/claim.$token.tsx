import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PublicHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { claimPropertyTransfer } from "@/lib/housefile/server";

export const Route = createFileRoute("/claim/$token")({ component: ClaimTransfer });

function ClaimTransfer() {
  const { token } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const claim = useMutation({
    mutationFn: () => claimPropertyTransfer({ data: token }),
    onSuccess: (res) => {
      toast.success("This File is yours now");
      void navigate({ to: "/home/$id", params: { id: res.propertyId } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not claim"),
  });

  if (isPending) return null;
  if (!user) return <RedirectToSignIn />;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader compact>
        <Button asChild variant="ghost" size="sm">
          <Link to="/home">My houses</Link>
        </Button>
      </PublicHeader>
      <main className="mx-auto max-w-md space-y-4 px-5 py-16 text-center">
        <h1 className="font-display text-3xl font-medium tracking-tight">Take this House File</h1>
        <p className="text-muted-foreground">
          Sale or inheritance. The jobs, warranties, and maintenance stay with the address.
        </p>
        <Button type="button" onClick={() => claim.mutate()} disabled={claim.isPending}>
          {claim.isPending ? "Moving the File…" : "Accept the record"}
        </Button>
      </main>
    </div>
  );
}
