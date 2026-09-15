import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  FactsPanel,
  JobTimeline,
  KnownProviders,
  PhotoGrid,
  RecordSection,
  WarrantyList,
} from "@/components/house-panels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { MaintenanceBadge } from "@/components/status-badge";
import { cadenceLabel, taskStatus, todayIso } from "@/lib/housefile/maintain";
import { shortDate } from "@/lib/housefile/format";
import { managerInviteLetter, managerInviteSubject } from "@/lib/housefile/invite";
import { RfpForm, RfpList } from "@/components/rfp-panel";
import { CATEGORY_PHOTO } from "@/lib/housefile/fields";
import {
  completePortfolioMaintenance,
  getPortfolioRecord,
  invitePortfolioOwner,
  schedulePortfolioMaintenance,
} from "@/lib/housefile/server";
import type { MaintenanceTask } from "@/lib/housefile/types";

export const Route = createFileRoute("/manage/$id")({ component: ManageRecord });

function ManageRecord() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ["portfolio-record", id],
    queryFn: () => getPortfolioRecord({ data: id }),
  });
  const refresh = () => {
    void q.refetch();
    void queryClient.invalidateQueries({ queryKey: ["portfolio"] });
  };
  const done = useMutation({
    mutationFn: (taskId: string) => completePortfolioMaintenance({ data: { taskId } }),
    onSuccess: () => {
      toast.success("Logged. Next due date is on the Property Record.");
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not log"),
  });
  const schedule = useMutation({
    mutationFn: (input: { taskId: string; scheduledOn: string | null; scheduledNote?: string }) =>
      schedulePortfolioMaintenance({ data: input }),
    onSuccess: () => {
      toast.success("Schedule updated");
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not schedule"),
  });

  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (!q.data) return <p className="text-destructive">Property not found.</p>;

  const { house, tasks, claimed, acceptedEstimates } = q.data;
  const p = house.property;
  const open = tasks.filter((t) => !t.completed_at);
  const due = open.filter((t) => new Date(t.due_on) <= new Date(Date.now() + 14 * 86400000));
  const hero = house.photos.find((ph) => ph.category === "exterior") ?? house.photos[0];
  const agreed = acceptedEstimates ?? [];

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
        <p className="text-sm tracking-wide text-muted-foreground uppercase">Property Record</p>
        <h1 className="font-display text-3xl font-medium tracking-tight">{p.address_line}</h1>
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

      <RecordSection
        title="Invite the owner"
        blurb={
          claimed
            ? "The owner has a login on this record. You still keep the file in the portfolio."
            : "They claim the same Property Record. You keep managing the house."
        }
        photo={CATEGORY_PHOTO.house}
        countLabel={claimed ? "Claimed" : p.homeowner_email ? "Invite sent" : "Not claimed"}
        chips={
          p.homeowner_email ? (
            <ul className="flex flex-wrap gap-1.5">
              <li className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                {p.homeowner_name && p.homeowner_name !== "Owner" ? p.homeowner_name : p.homeowner_email}
              </li>
            </ul>
          ) : undefined
        }
      >
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
      </RecordSection>
      <PhotoGrid file={house} mode="homeowner" token={p.share_token} onChanged={() => q.refetch()} />
      <FactsPanel file={house} mode="homeowner" token={p.share_token} onChanged={() => q.refetch()} />
      <JobTimeline file={house} />
      <KnownProviders providers={q.data.knownProviders ?? []} />
      <WarrantyList file={house} />
      <RecordSection
        id="request-estimates"
        title="Request Estimates"
        blurb="Measure first. Known shop from Estimates in the navbar, or request bids from shops that service this address."
        photo={CATEGORY_PHOTO.paint}
        chips={
          <ul className="flex flex-wrap gap-1.5">
            <li className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
              Invite a shop
            </li>
            <li className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
              How to measure
            </li>
          </ul>
        }
      >
        <p className="text-sm text-muted-foreground">
          Invite a go-to shop and take measurements on{" "}
          <Link to="/manage/estimates" className="underline underline-offset-2">
            Estimates
          </Link>
          .
        </p>
        <RfpList houseToken={p.share_token} />
        <RfpForm
          houseToken={p.share_token}
          addressLine={p.address_line}
          city={p.city}
          state={p.state}
          zip={p.zip}
          homeownerName={p.homeowner_name}
        />
      </RecordSection>

      {agreed.length > 0 ? (
        <RecordSection
          title="Agreed work"
          blurb="Estimates the owner has already accepted. They count as scheduled until the shop logs the job complete."
          photo={CATEGORY_PHOTO.house}
          countLabel={`${agreed.length} on file`}
        >
          <ul className="divide-y divide-border rounded-md bg-background shadow-[var(--shadow-border)]">
            {agreed.map((pr) => (
              <li key={pr.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="font-medium">{pr.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {pr.company_name} · accepted {shortDate(pr.accepted_at)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <MaintenanceBadge status="scheduled" />
                  {pr.share_token ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/p/$token" params={{ token: pr.share_token }}>
                        View estimate
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </RecordSection>
      ) : null}

      <RecordSection
        title="Maintenance"
        blurb={`${due.length} due in the next two weeks. Set a date when the work is agreed, then log it when it is done.`}
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
            <li key={t.id} className="space-y-3 px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.system_name} · {cadenceLabel(t.cadence)} · due {shortDate(t.due_on)}
                  </p>
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
              </div>
              <ScheduleTask
                task={t}
                pending={schedule.isPending}
                onSave={(scheduledOn, scheduledNote) =>
                  schedule.mutate({ taskId: t.id, scheduledOn, scheduledNote })
                }
              />
            </li>
          ))}
        </ul>
      </RecordSection>
    </div>
  );
}

function ScheduleTask({
  task,
  pending,
  onSave,
}: {
  task: MaintenanceTask;
  pending: boolean;
  onSave: (scheduledOn: string | null, scheduledNote?: string) => void;
}) {
  const [date, setDate] = useState(task.scheduled_on ?? "");
  const [note, setNote] = useState(task.scheduled_note ?? "");

  useEffect(() => {
    setDate(task.scheduled_on ?? "");
    setNote(task.scheduled_note ?? "");
  }, [task.scheduled_on, task.scheduled_note]);

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(date || null, note);
      }}
    >
      <div className="space-y-1">
        <Label htmlFor={`sched-${task.id}`}>Scheduled date</Label>
        <Input
          id={`sched-${task.id}`}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full sm:w-44"
        />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <Label htmlFor={`note-${task.id}`}>Note (optional)</Label>
        <Input
          id={`note-${task.id}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Vendor, window, or who agreed"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending || !date}>
          {task.scheduled_on ? "Update" : "Schedule"}
        </Button>
        {task.scheduled_on ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => onSave(null)}
          >
            Clear
          </Button>
        ) : null}
      </div>
    </form>
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
    <div className="space-y-4">
      {claimed ? (
        <p className="text-sm text-muted-foreground">
          Claimed
          {currentEmail ? ` · ${currentEmail}` : ""}
          {currentName && currentName !== "Owner" ? ` · ${currentName}` : ""}.
        </p>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            invite.mutate();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="owner-email">Owner email</Label>
            <Input
              id="owner-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
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
    </div>
  );
}
