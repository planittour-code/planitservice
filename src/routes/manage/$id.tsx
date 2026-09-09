import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  FactsPanel,
  JobTimeline,
  PhotoGrid,
  SectionRule,
  WarrantyList,
} from "@/components/house-panels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cadenceLabel } from "@/lib/housefile/maintain";
import { shortDate } from "@/lib/housefile/format";
import { managerInviteLetter, managerInviteSubject } from "@/lib/housefile/invite";
import { completePortfolioMaintenance, getPortfolioRecord, invitePortfolioOwner } from "@/lib/housefile/server";

export const Route = createFileRoute("/manage/$id")({ component: ManageRecord });

function ManageRecord() {
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["portfolio-record", id],
    queryFn: () => getPortfolioRecord({ data: id }),
  });
  const done = useMutation({
    mutationFn: (taskId: string) => completePortfolioMaintenance({ data: { taskId } }),
    onSuccess: () => {
      toast.success("Logged. Next due date is on the Property Record.");
      void q.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not log"),
  });

  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (!q.data) return <p className="text-destructive">Property not found.</p>;

  const { house, tasks, claimed } = q.data;
  const p = house.property;
  const open = tasks.filter((t) => !t.completed_at);
  const due = open.filter((t) => new Date(t.due_on) <= new Date(Date.now() + 14 * 86400000));
  const hero = house.photos.find((ph) => ph.category === "exterior") ?? house.photos[0];
  const issued = house.proposals.filter(
    (pr) => pr.status !== "pending" && pr.status !== "draft",
  );

  return (
    <div className="space-y-10">
      {hero && (
        <img
          src={hero.src}
          alt=""
          className="aspect-[16/9] w-full rounded-xl object-cover shadow-[var(--shadow-border)]"
        />
      )}
      <header className="space-y-2">
        <p className="text-sm tracking-wide text-muted-foreground uppercase">Property Record</p>
        <h1 className="font-display text-4xl font-medium tracking-tight">{p.address_line}</h1>
        <p className="text-muted-foreground">
          {p.city}, {p.state} {p.zip}
          {p.homeowner_name ? ` · ${p.homeowner_name}` : ""}
          {claimed
            ? " · Owner claimed"
            : p.homeowner_email
              ? " · Invite sent"
              : " · Not claimed yet"}
        </p>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Add photos first. Then fill house data and the jobs at this address. Shops quote in their
          own shop.
        </p>
      </header>

      <InviteOwner
        propertyId={p.id}
        claimed={claimed}
        currentEmail={p.homeowner_email}
        currentName={p.homeowner_name}
        inviteToken={p.invite_token}
        address={`${p.address_line}, ${p.city}, ${p.state} ${p.zip}`}
        office={q.data.portfolioName}
        onDone={() => q.refetch()}
      />
      <SectionRule />
      <PhotoGrid file={house} mode="homeowner" token={p.share_token} onChanged={() => q.refetch()} />
      <SectionRule />
      <FactsPanel file={house} mode="homeowner" token={p.share_token} onChanged={() => q.refetch()} />
      <SectionRule />
      <JobTimeline file={house} />
      <SectionRule />
      <WarrantyList file={house} />
      <SectionRule />

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-medium">Issued estimates</h2>
          <p className="text-sm text-muted-foreground">
            Quotes shops have already sent for this address. You cannot start a quote from here.
          </p>
        </div>
        {issued.length === 0 ? (
          <p className="text-sm text-muted-foreground">No issued estimates on this record yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl bg-card shadow-[var(--shadow-border)]">
            {issued.map((pr) => (
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
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-medium">Maintenance</h2>
          <p className="text-sm text-muted-foreground">
            {due.length} due in the next two weeks. Log the work so the next season is not a guess.
          </p>
        </div>
        <ul className="divide-y divide-border rounded-xl bg-card shadow-[var(--shadow-border)]">
          {open.map((t) => {
            const late = new Date(t.due_on) < new Date();
            return (
              <li
                key={t.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.system_name} · {cadenceLabel(t.cadence)} · due {shortDate(t.due_on)}
                    {late ? " · overdue" : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={done.isPending}
                  onClick={() => done.mutate(t.id)}
                >
                  Mark done
                </Button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function InviteOwner({
  propertyId,
  claimed,
  currentEmail,
  currentName,
  inviteToken,
  address,
  office,
  onDone,
}: {
  propertyId: string;
  claimed: boolean;
  currentEmail: string;
  currentName: string;
  inviteToken: string;
  address: string;
  office: string;
  onDone: () => void;
}) {
  const [email, setEmail] = useState(currentEmail);
  const [name, setName] = useState(currentName === "Owner" ? "" : currentName);

  useEffect(() => {
    setEmail(currentEmail);
    setName(currentName === "Owner" ? "" : currentName);
  }, [currentEmail, currentName]);
  const invite = useMutation({
    mutationFn: () =>
      invitePortfolioOwner({
        data: { propertyId, email, name: name.trim() || undefined },
      }),
    onSuccess: (res) => {
      toast.success(res.emailed ? "Invitation sent" : "Invite link ready");
      onDone();
      const path = `/invite/${res.inviteToken}`;
      void navigator.clipboard?.writeText(`${window.location.origin}${path}`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not invite"),
  });

  const inviteUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${inviteToken}`;
  const letter = managerInviteLetter({
    name: name.trim() || currentName || "there",
    address,
    office,
    inviteUrl: inviteUrl || `/invite/${inviteToken}`,
  });
  const subject = managerInviteSubject(office, address);

  return (
    <section className="space-y-4 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
      <div>
        <h2 className="font-display text-xl font-medium">Invite the owner</h2>
        <p className="text-sm text-muted-foreground">
          {claimed
            ? "The owner has a login on this record. You still keep the file in the portfolio."
            : "They claim the same Property Record. You keep managing the house."}
        </p>
      </div>
      {claimed ? (
        <p className="text-sm text-muted-foreground">
          Claimed
          {currentEmail ? ` · ${currentEmail}` : ""}
          {currentName && currentName !== "Owner" ? ` · ${currentName}` : ""}.
        </p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            invite.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="owner-email">Owner email</Label>
            <Input
              id="owner-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="owner-name">Owner name (optional)</Label>
            <Input id="owner-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending ? "Sending…" : "Send invitation"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(letter)}`;
              }}
            >
              Open in email
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(`${window.location.origin}/invite/${inviteToken}`).then(
                  () => toast.success("Invite link copied"),
                  () => toast.error("Could not copy the link"),
                );
              }}
            >
              Copy invite link
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
