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
import type { CompanyMember } from "@/lib/housefile/types";
import {
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
  members,
  onChanged,
}: {
  proposalId: string;
  proposalStatus: string;
  members: CompanyMember[];
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
  const [memberId, setMemberId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    setAssignee(wo?.assignee ?? "");
    setMemberId(wo?.assignee_member_id ?? "");
    setStartDate(wo?.start_date ?? "");
    setEndDate(wo?.end_date ?? "");
    setNotes(wo?.notes ?? "");
  }, [wo?.id, wo?.updated_at]);

  const refresh = () => {
    void q.refetch();
    onChanged?.();
  };
  const create = useMutation({
    mutationFn: () => createWorkOrder({ data: { proposalId } }),
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
            assignee: assignee.trim() || null,
            assigneeMemberId: memberId || null,
            startDate: startDate || null,
            endDate: endDate || null,
            notes: notes.trim() || null,
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
        <Button className="mt-3" type="button" disabled={create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? "Opening…" : "Create work order"}
        </Button>
      </section>
    );
  }

  const closed = wo.status === "complete" || wo.status === "cancelled";
  const total = bundle!.items.reduce((sum, i) => sum + i.qty * i.unit_price, 0);
  const pickable = members.filter((m) => !m.id.startsWith("owner-"));

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
          save.mutate();
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="wo-member">Assign to team</Label>
          <select
            id="wo-member"
            className="h-10 w-full rounded-md bg-background px-3 text-sm shadow-[var(--shadow-border)]"
            value={memberId}
            disabled={closed}
            onChange={(e) => {
              setMemberId(e.target.value);
              const m = pickable.find((x) => x.id === e.target.value);
              if (m) setAssignee(m.name || m.email);
            }}
          >
            <option value="">Nobody picked</option>
            {pickable.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.email}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="wo-assignee">Assignee (crew or sub)</Label>
          <Input
            id="wo-assignee"
            value={assignee}
            disabled={closed}
            maxLength={120}
            onChange={(e) => setAssignee(e.target.value)}
          />
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
        {!closed ? (
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={save.isPending}>
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
