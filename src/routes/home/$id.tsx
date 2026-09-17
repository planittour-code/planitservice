import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  FactsPanel,
  JobTimeline,
  KnownProviders,
  PhotoGrid,
  RecordSection,
  WarrantyList,
} from "@/components/house-panels";
import { CATEGORY_PHOTO } from "@/lib/housefile/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cadenceLabel, taskStatus, todayIso } from "@/lib/housefile/maintain";
import { shortDate } from "@/lib/housefile/format";
import { MaintenanceBadge } from "@/components/status-badge";
import { MeasureGuidePanel } from "@/components/measure-guide";
import { RfpForm, RfpList } from "@/components/rfp-panel";
import { UpgradeToPro } from "@/components/upgrade-to-pro";
import {
  completeMaintenance,
  getHomeRecord,
  startPropertyTransfer,
} from "@/lib/housefile/server";
import { confirmHomeownerCheckout } from "@/lib/housefile/stripe-billing";

const searchSchema = z.object({
  session_id: z.string().optional(),
});

export const Route = createFileRoute("/home/$id")({
  validateSearch: (s) => searchSchema.parse(s),
  component: HomeRecord,
});

function HomeRecord() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ["home-record", id],
    queryFn: () => getHomeRecord({ data: id }),
  });

  useEffect(() => {
    if (!search.session_id) return;
    let cancelled = false;
    void confirmHomeownerCheckout({ data: search.session_id })
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok && res.pro) {
          toast.success("Pro is on. Photos, jobs, and shops on this record stayed.");
          await queryClient.invalidateQueries({ queryKey: ["home-record", id] });
          await queryClient.invalidateQueries({ queryKey: ["household"] });
        }
        void navigate({ to: "/home/$id", params: { id }, search: {}, replace: true });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Could not confirm Pro checkout");
      });
    return () => {
      cancelled = true;
    };
  }, [search.session_id, id, navigate, queryClient]);
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
    <div className="space-y-6">
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
        <h1 className="font-display text-3xl font-medium tracking-tight">{p.address_line}</h1>
        <p className="text-muted-foreground">
          {p.city}, {p.state} {p.zip}
        </p>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Photos first. Then house data, jobs, and the shops that already worked here.
        </p>
      </header>

      <PhotoGrid file={house} mode="homeowner" token={p.share_token} onChanged={() => q.refetch()} />
      <FactsPanel file={house} mode="homeowner" token={p.share_token} onChanged={() => q.refetch()} />
      <JobTimeline file={house} />
      <KnownProviders providers={q.data.knownProviders ?? []} />
      <WarrantyList file={house} />

      <RecordSection
        title="Maintenance"
        blurb={`${due.length} due in the next two weeks. Log the work so the next season is not a guess.`}
        photo={CATEGORY_PHOTO.systems}
        countLabel={`${open.length} open`}
        chips={
          due.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {due.slice(0, 6).map((t) => (
                <li key={t.id} className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                  {t.title}
                </li>
              ))}
            </ul>
          ) : undefined
        }
      >
        <ul className="divide-y divide-border rounded-md bg-background shadow-[var(--shadow-border)]">
          {open.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{t.title}</p>
                <p className="text-sm text-muted-foreground">
                  {t.system_name} · {cadenceLabel(t.cadence)} · due {shortDate(t.due_on)}
                  {t.scheduled_on ? ` · scheduled ${shortDate(t.scheduled_on)}` : ""}
                </p>
                {t.scheduled_note ? (
                  <p className="text-sm text-muted-foreground">{t.scheduled_note}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <MaintenanceBadge status={taskStatus(t, todayIso())} />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={done.isPending}
                  onClick={() => done.mutate(t.id)}
                >
                  Mark done
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </RecordSection>

      <RecordSection
        title="Transfer this Property Record"
        blurb="The Property Record moves with the house."
        photo={CATEGORY_PHOTO.house}
      >
        <TransferForm propertyId={p.id} pending={transfer} onDone={() => q.refetch()} />
      </RecordSection>

      <MeasureGuidePanel audience="homeowner" />

      <RecordSection
        id="request-estimates"
        title="Request Estimates"
        defaultOpen={plan?.tier !== "pro"}
        blurb={
          plan?.tier === "pro"
            ? "Ask shops that offer this trade and service this address. Put measurements on the record first."
            : "Named shop you already know is Standard. Request Estimates is Pro."
        }
        photo={CATEGORY_PHOTO.paint}
        chips={
          <ul className="flex flex-wrap gap-1.5">
            {["Paint", "Roof", "Windows", "Gutters", "Flooring"].map((label) => (
              <li key={label} className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                {label}
              </li>
            ))}
          </ul>
        }
      >
        {plan?.tier === "pro" ? (
          <>
            <RfpList houseToken={p.share_token} />
            <RfpForm
              houseToken={p.share_token}
              addressLine={p.address_line}
              city={p.city}
              state={p.state}
              zip={p.zip}
              homeownerName={p.homeowner_name}
            />
          </>
        ) : (
          <UpgradeToPro
            propertyId={p.id}
            cadence={plan?.cadence === "annual" ? "annual" : "monthly"}
            onUpgraded={() => void q.refetch()}
          />
        )}
      </RecordSection>
    </div>
  );
}

function TransferForm({
  propertyId,
  pending,
  onDone,
}: {
  propertyId: string;
  pending: { to_email: string; token: string } | null;
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const send = useMutation({
    mutationFn: () => startPropertyTransfer({ data: { propertyId, toEmail: email } }),
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
        Waiting on {pending.to_email}. Share{" "}
        <Link to="/claim/$token" params={{ token: pending.token }} className="underline">
          the transfer link
        </Link>
        .
      </p>
    );
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        send.mutate();
      }}
    >
      <p className="text-sm text-muted-foreground">
        The Property Record moves with the house. They sign in with this email and take the record.
      </p>
      <div className="space-y-1">
        <Label htmlFor="to">New owner email</Label>
        <Input id="to" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <Button type="submit" disabled={send.isPending}>
        {send.isPending ? "Sending…" : "Create transfer link"}
      </Button>
    </form>
  );
}
