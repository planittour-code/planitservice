import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { shortDate } from "@/lib/housefile/format";
import { inviteNamedShop } from "@/lib/housefile/server";
import type { FileWorkInvite, ProposalListRow } from "@/lib/housefile/types";

export function NamedShopInvite({
  propertyId,
  invites,
  estimates,
  onDone,
  allowed = true,
}: {
  propertyId: string;
  invites: FileWorkInvite[];
  estimates: ProposalListRow[];
  onDone: () => void;
  allowed?: boolean;
}) {
  if (!allowed) {
    return (
      <div className="relative">
        <button
          type="button"
          disabled
          title="Invite a shop is on Pro"
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-white/40"
        >
          Invite a shop
          <ChevronDown className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <details className="relative">
      <summary className="inline-flex h-7 cursor-pointer list-none items-center gap-1 rounded-md px-2 text-xs font-medium text-white/90 hover:bg-white/10 hover:text-white [&::-webkit-details-marker]:hidden">
        Invite a shop
        <ChevronDown className="size-4" aria-hidden />
      </summary>
      <div
        id="invite-shop"
        className="absolute right-0 z-40 mt-1 w-[min(24rem,calc(100vw-2rem))] space-y-3 rounded-xl bg-card p-3 text-foreground shadow-[var(--shadow-border-hover)]"
      >
        <NamedShopInviteForm
          propertyId={propertyId}
          invites={invites}
          estimates={estimates}
          onDone={onDone}
        />
      </div>
    </details>
  );
}

export function NamedShopInviteForm({
  propertyId,
  invites,
  estimates,
  onDone,
}: {
  propertyId: string;
  invites: FileWorkInvite[];
  estimates: ProposalListRow[];
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [shopName, setShopName] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const save = useMutation({
    mutationFn: () =>
      inviteNamedShop({
        data: { propertyId, shopEmail: email, shopName, title, body },
      }),
    onSuccess: (res) => {
      toast.success(res.emailed ? "Invite sent to the shop." : "Invite saved. Email did not go out.");
      setEmail("");
      setShopName("");
      setTitle("");
      setBody("");
      onDone();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not invite"),
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Send this address and the ask to one shop. They quote from the jobs already on this record.
      </p>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="shop-email">Shop email</Label>
            <Input
              id="shop-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="shop-name">Shop name (optional)</Label>
            <Input id="shop-name" value={shopName} onChange={(e) => setShopName(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="job-title">The job</Label>
          <Input
            id="job-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Replace the 5-inch gutters"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="job-body">What they need to know</Label>
          <Textarea
            id="job-body"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Photos are on this File. Include measurements and a product that can live on the record."
            required
          />
        </div>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Sending…" : "Invite a shop"}
        </Button>
      </form>

      {invites.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl bg-background shadow-[var(--shadow-border)]">
          {invites.map((invite) => (
            <li key={invite.id} className="px-4 py-3">
              <p className="font-medium">{invite.title}</p>
              <p className="text-sm text-muted-foreground">
                {invite.shop_name || invite.shop_email} · {invite.status} · {shortDate(invite.created_at)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <div>
        <h3 className="font-display text-lg font-medium">Estimates at this address</h3>
        <p className="text-sm text-muted-foreground">Quotes shops have already sent for this house.</p>
      </div>
      {estimates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          None yet. Invite a go-to shop above for an estimate on this record.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl bg-background shadow-[var(--shadow-border)]">
          {estimates.map((pr) => (
            <li key={pr.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <p className="font-medium">{pr.title}</p>
                <p className="text-sm text-muted-foreground">
                  {pr.status}
                  {pr.sent_at ? ` · sent ${shortDate(pr.sent_at)}` : ""}
                </p>
              </div>
              {pr.share_token ? (
                <Button asChild size="sm" variant="outline">
                  <Link to="/p/$token" params={{ token: pr.share_token }}>
                    View estimate
                  </Link>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
