import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money, shortDate } from "@/lib/housefile/format";
import {
  invoiceNoProcessingLine,
  invoiceSeqLabel,
  invoiceStatusLabel,
  PAYMENT_METHODS,
  RETRACT_WINDOW_DAYS,
  type InvoiceItemInput,
  type InvoiceStatus,
  type InvoiceSummary,
} from "@/lib/housefile/invoices";
import {
  addInvoiceNoteFn,
  createInvoiceFromWorkOrder,
  getInvoiceForWorkOrder,
  listPropertyInvoices,
  markInvoicePaidFn,
  retractInvoicePaymentFn,
  sendInvoiceFn,
  updateInvoiceDraftFn,
  voidInvoiceFn,
} from "@/lib/housefile/server";

export function InvoiceBadge({ status }: { status: InvoiceStatus }) {
  const variant =
    status === "paid" ? "muted" : status === "void" ? "outline" : status === "partially_paid" ? "warning" : "default";
  return <Badge variant={variant}>{invoiceStatusLabel(status)}</Badge>;
}

const fail = (error: unknown) => toast.error(error instanceof Error ? error.message : "Something went wrong");

/** Shop view: create and manage the invoice for one work order. */
export function InvoicePanel({ workOrderId, workOrderStatus }: { workOrderId: string; workOrderStatus: string }) {
  const q = useQuery({
    queryKey: ["invoice", workOrderId],
    queryFn: () => getInvoiceForWorkOrder({ data: workOrderId }),
  });
  const bundle = q.data ?? null;
  const inv = bundle?.invoice ?? null;
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<InvoiceItemInput[] | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [note, setNote] = useState("");
  const refresh = () => {
    setLines(null);
    void q.refetch();
  };

  const create = useMutation({
    mutationFn: () => createInvoiceFromWorkOrder({ data: { workOrderId, dueDate: dueDate || null } }),
    onSuccess: refresh,
    onError: fail,
  });
  const save = useMutation({
    mutationFn: () =>
      updateInvoiceDraftFn({ data: { invoiceId: inv!.id, patch: { dueDate: dueDate || inv!.due_date, items: lines ?? undefined } } }),
    onSuccess: () => {
      toast.success("Invoice saved");
      refresh();
    },
    onError: fail,
  });
  const send = useMutation({
    mutationFn: () => sendInvoiceFn({ data: inv!.id }),
    onSuccess: (r) => {
      toast.success(r.emailed ? "Invoice sent" : "Marked sent (no homeowner email on file)");
      refresh();
    },
    onError: fail,
  });
  const pay = useMutation({
    mutationFn: () =>
      markInvoicePaidFn({
        data: { invoiceId: inv!.id, amount: amount ? Number(amount) : null, method: method || null, note: note || null },
      }),
    onSuccess: () => {
      setAmount("");
      setNote("");
      refresh();
    },
    onError: fail,
  });
  const retract = useMutation({
    mutationFn: (paymentId: string) => retractInvoicePaymentFn({ data: { paymentId } }),
    onSuccess: refresh,
    onError: fail,
  });
  const voidIt = useMutation({
    mutationFn: () => voidInvoiceFn({ data: { invoiceId: inv!.id } }),
    onSuccess: refresh,
    onError: fail,
  });
  const addNote = useMutation({
    mutationFn: () => addInvoiceNoteFn({ data: { invoiceId: inv!.id, note } }),
    onSuccess: () => {
      setNote("");
      refresh();
    },
    onError: fail,
  });

  if (q.isLoading) return null;
  if (!inv || !bundle) {
    if (workOrderStatus === "cancelled") return null;
    return (
      <section className="space-y-2 rounded-md border border-border p-4">
        <h3 className="font-medium">Invoice</h3>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="inv-due">Due date</Label>
            <Input id="inv-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create invoice"}
          </Button>
        </div>
      </section>
    );
  }

  const draft = inv.status === "draft";
  const editLines: InvoiceItemInput[] =
    lines ?? bundle.items.map((i) => ({ name: i.name, description: i.description, qty: i.qty, unit: i.unit, unit_price: i.unit_price }));
  const setLine = (idx: number, patch: Partial<InvoiceItemInput>) =>
    setLines(editLines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const now = Date.now();

  return (
    <section className="space-y-3 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">
          Invoice {invoiceSeqLabel(inv.seq)} <span className="text-muted-foreground"># {inv.number}</span>
        </h3>
        <InvoiceBadge status={inv.status} />
        {inv.due_date ? <span className="text-sm text-muted-foreground">Due {shortDate(inv.due_date)}</span> : null}
      </div>

      <table className="w-full text-sm">
        <tbody>
          {editLines.map((l, idx) => (
            <tr key={idx} className="border-b border-border">
              <td className="py-1 pr-2">
                {draft ? <Input value={l.name} onChange={(e) => setLine(idx, { name: e.target.value })} /> : l.name}
              </td>
              <td className="w-20 py-1 pr-2">
                {draft ? (
                  <Input type="number" value={l.qty} onChange={(e) => setLine(idx, { qty: Number(e.target.value) })} />
                ) : (
                  `${l.qty} ${l.unit ?? ""}`
                )}
              </td>
              <td className="w-28 py-1 text-right">
                {draft ? (
                  <Input
                    type="number"
                    value={l.unit_price}
                    onChange={(e) => setLine(idx, { unit_price: Number(e.target.value) })}
                  />
                ) : (
                  money(l.unit_price)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-sm">
        Total {money(bundle.totals.total)} · Recorded {money(bundle.totals.paid)} ·{" "}
        <strong>Amount due {money(bundle.totals.amountDue)}</strong>
      </p>

      {draft ? (
        <div className="flex flex-wrap items-end gap-2">
          <Button variant="outline" onClick={() => setLines([...editLines, { name: "", qty: 1, unit_price: 0 }])}>
            Add line
          </Button>
          <div>
            <Label htmlFor="inv-due-edit">Due date</Label>
            <Input id="inv-due-edit" type="date" value={dueDate || inv.due_date || ""} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => save.mutate()} disabled={save.isPending}>
            Save draft
          </Button>
          <Button onClick={() => send.mutate()} disabled={send.isPending || lines !== null}>
            Send invoice
          </Button>
        </div>
      ) : null}

      {inv.status === "sent" || inv.status === "partially_paid" ? (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="inv-amt">Amount (blank = full amount due)</Label>
            <Input id="inv-amt" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="inv-method">Method</Label>
            <select
              id="inv-method"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="">Not specified</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m === "ach" ? "ACH" : m[0].toUpperCase() + m.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={() => pay.mutate()} disabled={pay.isPending}>
            Mark paid
          </Button>
        </div>
      ) : null}
      {draft || inv.status === "sent" ? (
        <Button variant="ghost" onClick={() => voidIt.mutate()} disabled={voidIt.isPending}>
          Void invoice
        </Button>
      ) : null}

      {bundle.payments.length ? (
        <div className="space-y-1">
          <h4 className="text-sm font-medium">Payment history</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {bundle.payments.map((p, idx) => {
              const reversed = bundle.payments.some((r) => r.reverses_id === p.id);
              const canRetract =
                !p.reverses_id && !reversed && now - new Date(p.created_at).getTime() <= RETRACT_WINDOW_DAYS * 86400000;
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-2">
                  <span>{bundle.history[idx]}</span>
                  {canRetract ? (
                    <Button size="sm" variant="ghost" onClick={() => retract.mutate(p.id)} disabled={retract.isPending}>
                      Retract
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {!draft ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="grow">
            <Label htmlFor="inv-note">Note (added to history)</Label>
            <Input id="inv-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => addNote.mutate()} disabled={!note.trim() || addNote.isPending}>
            Add note
          </Button>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">{invoiceNoProcessingLine(bundle.shopName)}</p>
    </section>
  );
}

/** Read-only list for the homeowner (/home) and an entitled PM (portfolio file). */
export function PropertyInvoices({ propertyId }: { propertyId: string }) {
  const q = useQuery({
    queryKey: ["property-invoices", propertyId],
    queryFn: () => listPropertyInvoices({ data: propertyId }),
  });
  const rows: InvoiceSummary[] = q.data ?? [];
  if (!rows.length) return null;
  return (
    <section className="space-y-2">
      <h3 className="font-medium">Invoices</h3>
      <ul className="space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.id} className="space-y-1 rounded-md border border-border p-3">
            <p className="flex flex-wrap items-center gap-2">
              <span>
                {r.shopName} · {invoiceSeqLabel(r.seq)} # {r.number}
              </span>
              <InvoiceBadge status={r.status} />
            </p>
            <p className="text-muted-foreground">
              Total {money(r.total)} · Amount due {money(r.amountDue)}
              {r.due_date ? ` · Due ${shortDate(r.due_date)}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">{invoiceNoProcessingLine(r.shopName)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
