import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { money, shortDate, shortDateTime } from "@/lib/housefile/format";
import {
  createWorkOrder,
  getWorkOrderForProposal,
  updateWorkOrder,
  updateWorkOrderStatus,
} from "@/lib/housefile/server";
import {
  isValidAssigneeEmail,
  nextWorkOrderStatuses,
  workOrderNumberLabel,
  workOrderStatusLabel,
  type WorkOrderPublicStatus,
  type WorkOrderStatus,
} from "@/lib/housefile/work-orders";

export function WorkOrderBadge({ status }: { status: WorkOrderStatus }) {
  const variant =
    status === "complete"
      ? "muted"
      : status === "cancelled"
        ? "outline"
        : status === "in_progress"
          ? "warning"
          : "default";
  return <Badge variant={variant}>{workOrderStatusLabel(status)}</Badge>;
}

/** Read-only line for homeowners and property managers. No notes, no assignee. */
export function WorkOrderStatusLine({ workOrder }: { workOrder: WorkOrderPublicStatus }) {
  const when = workOrder.start_date
    ? workOrder.end_date && workOrder.end_date !== workOrder.start_date
      ? `${shortDate(workOrder.start_date)} – ${shortDate(workOrder.end_date)}`
      : shortDate(workOrder.start_date)
    : null;
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span>Work order {workOrderNumberLabel(workOrder.number)}</span>
      <WorkOrderBadge status={workOrder.status} />
      {when ? <span>{when}</span> : null}
    </p>
  );
}

const ACTION_LABEL: Record<WorkOrderStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "Start work",
  complete: "Mark job complete",
  cancelled: "Cancel work order",
};

/** Shop view: see and update the WO for one sold estimate. */
export function WorkOrderPanel({
  proposalId,
  proposalStatus,
  onChanged,
}: {
  proposalId: string;
  proposalStatus: string;
  onChanged?: () => void;
}) {
  const sold = proposalStatus === "accepted" || proposalStatus === "completed";
  const q = useQuery({
    queryKey: ["work-order", proposalId],
    queryFn: () => getWorkOrderForProposal({ data: proposalId }),
    enabled: sold,
  });
  const bundle = q.data ?? null;
  const wo = bundle?.workOrder ?? null;

  const [assignee, setAssignee] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [showPrices, setShowPrices] = useState(true);
  useEffect(() => {
    setAssignee(wo?.assignee_email ?? "");
    setStartDate(wo?.start_date ?? "");
    setEndDate(wo?.end_date ?? "");
    setNotes(wo?.notes ?? "");
    setShowPrices(wo ? wo.show_prices !== false : true);
    // Reset the form only when the saved WO changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wo?.id, wo?.updated_at]);
  const emailOk = isValidAssigneeEmail(assignee);
  const datesOk = !startDate || !endDate || endDate >= startDate;

  const refresh = () => {
    void q.refetch();
    onChanged?.();
  };
  const create = useMutation({
    mutationFn: () =>
      createWorkOrder({
        data: {
          proposalId,
          patch: {
            assigneeEmail: assignee.trim().toLowerCase() || null,
            startDate: startDate || null,
            endDate: endDate || null,
          },
        },
      }),
    onSuccess: () => {
      toast.success("Work order ready");
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not open work order"),
  });
  const move = useMutation({
    mutationFn: (status: WorkOrderStatus) =>
      updateWorkOrderStatus({ data: { workOrderId: wo!.id, status } }),
    onSuccess: (r) => {
      toast.success(`Work order ${workOrderStatusLabel(r.status).toLowerCase()}`);
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update status"),
  });
  const save = useMutation({
    mutationFn: () =>
      updateWorkOrder({
        data: {
          workOrderId: wo!.id,
          patch: {
            assigneeEmail: assignee.trim().toLowerCase() || null,
            startDate: startDate || null,
            endDate: endDate || null,
            notes: notes.trim() || null,
            showPrices,
          },
        },
      }),
    onSuccess: () => {
      toast.success("Work order saved");
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save"),
  });

  if (!sold) return null;
  if (q.isLoading) return null;

  if (!wo) {
    return (
      <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-lg font-medium">Work order</h2>
        <p className="text-sm text-muted-foreground">No work order on this sold estimate yet.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="wo-new-assignee">Assignee email (optional)</Label>
            <Input
              id="wo-new-assignee"
              type="email"
              value={assignee}
              maxLength={254}
              aria-invalid={!emailOk}
              onChange={(e) => setAssignee(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wo-new-start">Start date</Label>
            <Input id="wo-new-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wo-new-end">End date</Label>
            <Input
              id="wo-new-end"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        {!emailOk ? <p className="mt-1 text-xs text-destructive">Enter a valid email address.</p> : null}
        {!datesOk ? <p className="mt-1 text-xs text-destructive">End date can’t be before the start date.</p> : null}
        <Button
          className="mt-3"
          type="button"
          disabled={create.isPending || !emailOk || !datesOk}
          onClick={() => create.mutate()}
        >
          {create.isPending ? "Opening…" : "Create work order"}
        </Button>
      </section>
    );
  }

  const closed = wo.status === "complete" || wo.status === "cancelled";
  const total = bundle!.items.reduce((sum, i) => sum + i.qty * i.unit_price, 0);

  return (
    <section className="space-y-4 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-medium">
            Work order {workOrderNumberLabel(wo.number)}
          </h2>
          <WorkOrderBadge status={wo.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {nextWorkOrderStatuses(wo.status).map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={s === "cancelled" ? "ghost" : s === "complete" ? "default" : "outline"}
              disabled={move.isPending}
              onClick={() => {
                if (s === "cancelled" && !window.confirm("Cancel this work order? This cannot be undone.")) return;
                move.mutate(s);
              }}
            >
              {ACTION_LABEL[s]}
            </Button>
          ))}
        </div>
      </div>

      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!emailOk || !datesOk) return;
          save.mutate();
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="wo-assignee">Assignee email (worker)</Label>
          <Input
            id="wo-assignee"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="crew@example.com"
            value={assignee}
            disabled={closed}
            maxLength={254}
            aria-invalid={!emailOk}
            onChange={(e) => setAssignee(e.target.value)}
          />
          {!emailOk ? <p className="text-xs text-destructive">Enter a valid email address.</p> : (
            <p className="text-xs text-muted-foreground">They get one email with the job details when assigned. Prices are included unless you turn off “Show prices”.</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="wo-start">Start date</Label>
          <Input
            id="wo-start"
            type="date"
            value={startDate}
            disabled={closed}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="wo-end">End date</Label>
          <Input
            id="wo-end"
            type="date"
            value={endDate}
            min={startDate || undefined}
            disabled={closed}
            onChange={(e) => setEndDate(e.target.value)}
          />
          {!datesOk ? <p className="text-xs text-destructive">End date can’t be before the start date.</p> : null}
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="wo-notes">Internal notes (shop only)</Label>
          <Textarea
            id="wo-notes"
            value={notes}
            disabled={closed}
            maxLength={4000}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={showPrices}
            disabled={closed}
            onChange={(e) => setShowPrices(e.target.checked)}
          />
          Show prices to the worker (line prices and total in their email)
        </label>
        {!closed ? (
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={save.isPending || !emailOk || !datesOk}>
              {save.isPending ? "Saving…" : "Save work order"}
            </Button>
          </div>
        ) : null}
      </form>

      <div>
        <h3 className="text-sm font-semibold">Line items (copied from the accepted estimate)</h3>
        <ul className="mt-2 divide-y divide-border text-sm">
          {bundle!.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 py-1.5">
              <span>
                {i.name}
                {i.color ? ` · ${i.color}` : ""}
                <span className="text-muted-foreground">
                  {" "}
                  · {i.qty} {i.unit}
                </span>
              </span>
              <span className="tabular-nums">{money(i.qty * i.unit_price)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-right text-sm font-semibold tabular-nums">{money(total)}</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold">Activity</h3>
        <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
          {bundle!.events.map((ev) => (
            <li key={ev.id}>
              <span className="tabular-nums">{shortDateTime(ev.created_at)}</span> · {ev.actor} ·{" "}
              {ev.kind === "created"
                ? `Opened as ${ev.to_status ? workOrderStatusLabel(ev.to_status) : "work order"}`
                : ev.kind === "status" && ev.from_status && ev.to_status
                  ? `${workOrderStatusLabel(ev.from_status)} → ${workOrderStatusLabel(ev.to_status)}`
                  : ev.detail}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
