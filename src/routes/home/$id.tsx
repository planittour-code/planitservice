import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
import {
  completeMaintenance,
  getHomeRecord,
  startPropertyTransfer,
} from "@/lib/housefile/server";

export const Route = createFileRoute("/home/$id")({ component: HomeRecord });

function HomeRecord() {
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["home-record", id],
    queryFn: () => getHomeRecord({ data: id }),
  });
  const done = useMutation({
    mutationFn: (taskId: string) => completeMaintenance({ data: { taskId } }),
    onSuccess: () => {
      toast.success("Logged. Next due date is on the Property Record.");
      void q.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not log"),
  });

  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (!q.data) return <p className="text-destructive">Property not found.</p>;

  const { house, plan, tasks, transfer } = q.data;
  const p = house.property;
  const open = tasks.filter((t) => !t.completed_at);
  const due = open.filter((t) => new Date(t.due_on) <= new Date(Date.now() + 14 * 86400000));
  const hero = house.photos.find((ph) => ph.category === "exterior") ?? house.photos[0];

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
        <p className="text-sm tracking-wide text-muted-foreground uppercase">
          {plan?.tier === "pro" ? "Pro Property Record" : "Property Record"}
          {plan ? ` · ${plan.cadence}` : ""}
        </p>
        <h1 className="font-display text-4xl font-medium tracking-tight">{p.address_line}</h1>
        <p className="text-muted-foreground">
          {p.city}, {p.state} {p.zip}
        </p>
      </header>

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
              <li key={t.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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

      <SectionRule />
      <JobTimeline file={house} />
      <SectionRule />
      <WarrantyList file={house} />
      <SectionRule />
      <PhotoGrid file={house} mode="homeowner" token={p.share_token} onChanged={() => q.refetch()} />
      <SectionRule />
      <FactsPanel file={house} mode="homeowner" token={p.share_token} onChanged={() => q.refetch()} />

      <section className="space-y-4 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl font-medium">Transfer this Property Record</h2>
        <TransferForm propertyId={p.id} pending={transfer} onDone={() => q.refetch()} />
      </section>

      {plan?.tier !== "pro" ? (
        <p className="text-sm text-muted-foreground">
          Pro puts an RFP on the market and lets a property manager see the Property Record and the bids.{" "}
          <Link to="/home/add" search={{ tier: "pro" }} className="underline">
            Open the next property as Pro
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

function TransferForm({
  propertyId,
  pending,
  onDone,
}: {
  propertyId: string;
  pending: { to_email: string; reason: string; token: string } | null;
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState<"sale" | "death">("sale");
  const send = useMutation({
    mutationFn: () => startPropertyTransfer({ data: { propertyId, toEmail: email, reason } }),
    onSuccess: (res) => {
      toast.success("Transfer link ready");
      onDone();
      void navigator.clipboard?.writeText(`${window.location.origin}/claim/${res.token}`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not start transfer"),
  });

  if (pending) {
    return (
      <p className="text-sm text-muted-foreground">
        Waiting on {pending.to_email} ({pending.reason}). Share{" "}
        <Link to="/claim/$token" params={{ token: pending.token }} className="underline">
          the transfer link
        </Link>
        .
      </p>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        send.mutate();
      }}
    >
      <p className="text-sm text-muted-foreground">
        The Property Record moves with the house. They sign in with this email and take the record.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="to">New owner email</Label>
        <Input id="to" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant={reason === "sale" ? "default" : "outline"} onClick={() => setReason("sale")}>
          Sale
        </Button>
        <Button type="button" variant={reason === "death" ? "default" : "outline"} onClick={() => setReason("death")}>
          Death
        </Button>
      </div>
      <Button type="submit" disabled={send.isPending}>
        {send.isPending ? "Sending…" : "Create transfer link"}
      </Button>
    </form>
  );
}
