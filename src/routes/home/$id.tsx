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
import { shortDate } from "@/lib/housefile/format";
import { HomeownerSectionNav } from "@/components/homeowner-section-nav";
import { MaintenanceChecklist } from "@/components/maintenance-checklist";
import { MeasureGuidePanel } from "@/components/measure-guide";
import { RfpForm, RfpList } from "@/components/rfp-panel";
import { UpgradeToPro } from "@/components/upgrade-to-pro";
import {
  addHomeMaintenance,
  completeMaintenance,
  confirmPropertyTransfer,
  getHomeRecord,
  removeHomeMaintenance,
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
  const addTask = useMutation({
    mutationFn: (input: { title: string; system: string; cadence: string }) =>
      addHomeMaintenance({ data: { propertyId: id, ...input } }),
    onSuccess: () => {
      toast.success("Added to the checklist.");
      void q.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add"),
  });
  const removeTask = useMutation({
    mutationFn: (taskId: string) => removeHomeMaintenance({ data: { taskId } }),
    onSuccess: () => {
      toast.success("Removed from this house.");
      void q.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not remove"),
  });

  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (!q.data) return <p className="text-destructive">Property not found.</p>;

  const { house, plan, tasks, transfer } = q.data;
  const p = house.property;
  const open = tasks.filter((t) => !t.completed_at);
  const due = open.filter((t) => new Date(t.due_on) <= new Date(Date.now() + 14 * 86400000));
  const hero = house.photos.find((ph) => ph.category === "exterior") ?? house.photos[0];

  return (
    <div className="relative space-y-6 pr-14 sm:pr-16">
      <HomeownerSectionNav />
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
          {plan?.status === "complimentary" && plan.complimentary_until
            ? ` · free through ${shortDate(plan.complimentary_until)}`
            : plan?.status === "complimentary"
              ? " · free while we estimate"
              : plan
                ? ` · ${plan.cadence}`
                : ""}
        </p>
        <h1 className="font-display text-3xl font-medium tracking-tight">{p.address_line}</h1>
        <p className="text-muted-foreground">
          {p.city}, {p.state} {p.zip}
        </p>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Photos first. Then the job history, materials, measurements, and warranties agreed for this house.
        </p>
      </header>

      <div id="photos" className="scroll-mt-20">
        <PhotoGrid file={house} mode="homeowner" token={p.share_token} onChanged={() => q.refetch()} />
      </div>
      <div id="house-data" className="scroll-mt-20">
        <FactsPanel file={house} mode="homeowner" token={p.share_token} onChanged={() => q.refetch()} />
      </div>
      <div id="jobs" className="scroll-mt-20">
        <JobTimeline file={house} defaultOpen />
      </div>
      <div id="materials" className="scroll-mt-20">
        <JobTimeline file={house} mode="materials" defaultOpen />
      </div>
      <div id="shops" className="scroll-mt-20">
        <KnownProviders providers={q.data.knownProviders ?? []} />
      </div>
      <div id="warranties" className="scroll-mt-20">
        <WarrantyList file={house} defaultOpen />
      </div>

      <RecordSection
        id="maintenance"
        title="Maintenance"
        blurb={`${due.length} due in the next two weeks. Add your own checklist, or remove what this house does not need.`}
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
        <MaintenanceChecklist
          tasks={open}
          donePending={done.isPending}
          removePending={removeTask.isPending}
          addPending={addTask.isPending}
          onDone={(taskId) => done.mutate(taskId)}
          onRemove={(taskId) => removeTask.mutate(taskId)}
          onAdd={(input) => addTask.mutate(input)}
        />
      </RecordSection>

      <RecordSection
        id="transfer"
        title="Transfer this Property Record"
        blurb="Create transfer link emails you a confirm code. The record moves after you confirm."
        photo={CATEGORY_PHOTO.house}
      >
        <TransferForm propertyId={p.id} pending={transfer} onDone={() => q.refetch()} />
      </RecordSection>

      <div id="measure" className="scroll-mt-20">
        <MeasureGuidePanel audience="homeowner" />
      </div>

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
  pending: {
    to_email: string;
    token: string | null;
    awaiting_confirm: boolean;
    from_email: string;
    confirm_expires_at: string | null;
  } | null;
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const send = useMutation({
    mutationFn: () => startPropertyTransfer({ data: { propertyId, toEmail: email } }),
    onSuccess: (res) => {
      toast.success(`Confirm transfer email sent to ${res.fromEmail}`);
      onDone();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not start transfer"),
  });
  const confirm = useMutation({
    mutationFn: () => confirmPropertyTransfer({ data: { propertyId, code } }),
    onSuccess: (res) => {
      toast.success(`Transfer confirmed. Waiting on ${res.toEmail}.`);
      onDone();
      if (res.token) {
        void navigator.clipboard?.writeText(`${window.location.origin}/claim/${res.token}`);
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not confirm transfer"),
  });
  const resend = useMutation({
    mutationFn: () =>
      startPropertyTransfer({ data: { propertyId, toEmail: pending?.to_email ?? email } }),
    onSuccess: (res) => {
      toast.success(`Confirm transfer email sent to ${res.fromEmail}`);
      onDone();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not resend"),
  });

  if (pending?.awaiting_confirm) {
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          confirm.mutate();
        }}
      >
        <p className="text-sm text-muted-foreground">
          Two-factor check: you are signed in, and we sent a confirm transfer email to{" "}
          <span className="font-semibold text-foreground">{pending.from_email}</span>. Open that
          email, or enter the 6-digit code here, before a claim link is created for{" "}
          <span className="font-semibold text-foreground">{pending.to_email}</span>.
        </p>
        <div className="space-y-1">
          <Label htmlFor="transfer-code">Code from the email</Label>
          <Input
            id="transfer-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            required
            minLength={6}
            maxLength={6}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={confirm.isPending || code.trim().length !== 6}>
            {confirm.isPending ? "Confirming…" : "Confirm transfer"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={resend.isPending}
            onClick={() => resend.mutate()}
          >
            {resend.isPending ? "Sending…" : "Resend confirm email"}
          </Button>
        </div>
      </form>
    );
  }

  if (pending?.token) {
    return (
      <p className="text-sm text-muted-foreground">
        You confirmed the transfer. Waiting on {pending.to_email}. Share{" "}
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
        The Property Record moves with the house. Create transfer link emails you a confirm code.
        After you confirm, they sign in with this email and take the record.
      </p>
      <div className="space-y-1">
        <Label htmlFor="to">New owner email</Label>
        <Input id="to" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <Button type="submit" disabled={send.isPending}>
        {send.isPending ? "Sending confirm email…" : "Create transfer link"}
      </Button>
    </form>
  );
}
