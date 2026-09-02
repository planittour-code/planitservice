import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  MissingFactsPreview,
  PhotoGrid,
  SectionRule,
} from "@/components/house-panels";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { optionLabel } from "@/lib/housefile/estimate-lines";
import { money, shortDate } from "@/lib/housefile/format";
import {
  acceptProposalPublic,
  addContractorMessage,
  addHomeownerMessage,
  completeProposal,
  draftCoverNote,
  reviseProposalPublic,
  updateProposalMeta,
  upsertProposalItem,
} from "@/lib/housefile/server";
import type { ProposalBundle, ProposalItem } from "@/lib/housefile/types";
import { cn } from "@/lib/utils";

export function ProposalTotals({
  items,
  showCost = false,
}: {
  items: ProposalItem[];
  showCost?: boolean;
}) {
  const included = items.filter((i) => i.included);
  const total = included.reduce((sum, i) => sum + i.qty * i.unit_price, 0);
  const skipped = items.filter((i) => !i.included).reduce((sum, i) => sum + i.qty * i.unit_price, 0);
  const cost = included.reduce((sum, i) => sum + (i.unit_cost != null ? i.qty * i.unit_cost : 0), 0);
  return (
    <div className="flex flex-col items-end gap-1">
      {skipped > 0 && (
        <p className="text-sm text-muted-foreground">
          Optional not included {money(skipped)}
        </p>
      )}
      {showCost && cost > 0 && (
        <p className="text-sm text-muted-foreground">Material cost {money(cost)}</p>
      )}
      <p className="font-display text-2xl font-medium tabular-nums">{money(total)}</p>
    </div>
  );
}

export function ProposalDoc({
  bundle,
  mode,
  onChanged,
}: {
  bundle: ProposalBundle;
  mode: "homeowner" | "contractor";
  onChanged: () => void;
}) {
  const { proposal, items, messages, property, company, house } = bundle;
  const locked = proposal.status === "completed";
  const canAccept =
    mode === "homeowner" && proposal.status !== "accepted" && proposal.status !== "completed";
  const includedTotal = items.filter((i) => i.included).reduce((sum, i) => sum + i.qty * i.unit_price, 0);

  async function accept() {
    await acceptProposalPublic({ data: { token: proposal.share_token } });
    toast.success("Estimate accepted");
    onChanged();
  }

  return (
    <article className="space-y-8">
      <header className="space-y-3">
        {company.logo_src ? (
          <img
            src={company.logo_src}
            alt=""
            className="h-12 w-auto max-w-[12rem] object-contain"
          />
        ) : null}
        <p className="text-sm tracking-wide text-muted-foreground uppercase">
          {mode === "homeowner" ? `Estimate from ${company.name}` : company.name}
        </p>
        <h1 className="font-display text-3xl font-medium tracking-tight md:text-4xl">
          {proposal.title}
        </h1>
        <p className="text-muted-foreground">
          {property.address_line}, {property.city}, {property.state} {property.zip}
          {proposal.sent_at ? (
            <>
              <span className="mx-2">·</span>
              Sent {shortDate(proposal.sent_at)}
            </>
          ) : null}
        </p>
        {proposal.cover_note && (
          <p className="max-w-2xl text-base leading-relaxed">{proposal.cover_note}</p>
        )}
        {mode === "contractor" && (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={proposal.status} />
          </div>
        )}
      </header>

      {mode === "contractor" && !locked && (
        <ContractorMeta bundle={bundle} onChanged={onChanged} />
      )}

      <ul className="space-y-3">
        {items.filter((item) => !item.option_id).map((item) => (
          <ProposalLine
            key={item.id}
            item={item}
            mode={mode}
            token={proposal.share_token}
            locked={locked}
            onChanged={onChanged}
          />
        ))}
      </ul>
      <OptionGroups
        items={items}
        mode={mode}
        token={proposal.share_token}
        locked={locked}
        onChanged={onChanged}
      />

      {mode === "contractor" && !locked && <AddLine proposalId={proposal.id} onChanged={onChanged} />}

      <ProposalTotals items={items} showCost={mode === "contractor"} />

      {canAccept && (
        <AcceptEstimate total={includedTotal} onAccept={() => void accept()} sticky />
      )}

      {mode === "contractor" && !locked && (
        <>
          <SectionRule />
          <PhotoGrid file={house} mode={mode} onChanged={onChanged} />
          <SectionRule />
          <MissingFactsPreview file={house} mode={mode} onChanged={onChanged} />
        </>
      )}

      <section className="space-y-4">
        <h2 className="font-display text-xl font-medium">Notes on this estimate</h2>
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {mode === "homeowner"
              ? "No notes yet. Ask about a color, a room, or a product."
              : "No homeowner notes yet."}
          </p>
        )}
        <ol className="space-y-3">
          {messages.map((m) => (
            <li key={m.id} className="rounded-lg bg-card px-4 py-3 shadow-[var(--shadow-border)]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{m.author_name}</p>
                <time className="text-xs text-muted-foreground">{shortDate(m.created_at)}</time>
              </div>
              <p className="mt-1 text-sm leading-relaxed">{m.body}</p>
            </li>
          ))}
        </ol>
        {!locked && (
          <MessageForm
            mode={mode}
            proposalId={proposal.id}
            token={proposal.share_token}
            onChanged={onChanged}
          />
        )}
      </section>

      {mode === "homeowner" && company.terms ? (
        <section className="space-y-2">
          <h2 className="font-display text-xl font-medium">Terms</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {company.terms}
          </p>
        </section>
      ) : null}

      {mode === "contractor" && proposal.status !== "completed" && proposal.status !== "pending" && (
        <div className="flex flex-col gap-3 rounded-xl bg-muted px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            When the work is done, mark it complete. Colors, products, and warranties copy into the house file.
          </p>
          <Button
            onClick={async () => {
              await completeProposal({ data: { proposalId: proposal.id } });
              toast.success("Job written into the house file");
              onChanged();
            }}
          >
            Mark job complete
          </Button>
        </div>
      )}

      {canAccept && (
        <AcceptEstimate total={includedTotal} onAccept={() => void accept()} sticky />
      )}
    </article>
  );
}

function AcceptEstimate({
  total,
  onAccept,
  sticky,
}: {
  total: number;
  onAccept: () => void;
  sticky?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl bg-primary px-5 py-4 text-primary-foreground shadow-[var(--shadow-border)] sm:flex-row sm:items-center sm:justify-between",
        sticky && "sticky bottom-0 z-20 -mx-5 rounded-none px-5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-3 sm:mx-0 sm:rounded-xl sm:px-5 sm:pb-4",
      )}
    >
      <div>
        <p className="text-sm opacity-90">If this is right, accept it. The shop will schedule the work.</p>
        <p className="font-display text-2xl font-medium tabular-nums">{money(total)}</p>
      </div>
      <Button variant="secondary" className="min-h-12 w-full sm:w-auto" onClick={onAccept}>
        Accept this estimate
      </Button>
    </div>
  );
}

function ContractorMeta({
  bundle,
  onChanged,
}: {
  bundle: ProposalBundle;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState(bundle.proposal.title);
  const [cover, setCover] = useState(bundle.proposal.cover_note ?? "");
  const [drafting, setDrafting] = useState(false);
  return (
    <div className="space-y-3 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
      <div className="space-y-1.5">
        <Label htmlFor="pt">Title</Label>
        <Input id="pt" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pc">Cover note</Label>
        <Textarea id="pc" value={cover} onChange={(e) => setCover(e.target.value)} rows={4} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            await updateProposalMeta({
              data: { id: bundle.proposal.id, title, coverNote: cover },
            });
            toast.success("Proposal updated");
            onChanged();
          }}
        >
          Save heading
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={drafting}
          onClick={async () => {
            setDrafting(true);
            try {
              const res = await draftCoverNote({
                data: {
                  templateName: title,
                  address: `${bundle.property.address_line}, ${bundle.property.city}`,
                  homeownerName: bundle.property.homeowner_name,
                },
              });
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              setCover(res.text);
              toast.success("Cover note drafted — save it if you want to keep it");
            } finally {
              setDrafting(false);
            }
          }}
        >
          {drafting ? "Drafting…" : "Draft cover note"}
        </Button>
      </div>
    </div>
  );
}

function OptionGroups({
  items,
  mode,
  token,
  locked,
  onChanged,
}: {
  items: ProposalItem[];
  mode: "homeowner" | "contractor";
  token: string;
  locked: boolean;
  onChanged: () => void;
}) {
  const groups = new Map<string, ProposalItem[]>();
  for (const item of items) {
    if (!item.option_id) continue;
    const list = groups.get(item.option_id) ?? [];
    list.push(item);
    groups.set(item.option_id, list);
  }
  if (groups.size === 0) return null;
  return (
    <div className="space-y-3">
      <h2 className="font-display text-xl font-medium">Optional work</h2>
      {[...groups.entries()].map(([id, rows]) => (
        <OptionGroup
          key={id}
          optionId={id}
          items={rows}
          mode={mode}
          token={token}
          locked={locked}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}

function OptionGroup({
  optionId,
  items,
  mode,
  token,
  locked,
  onChanged,
}: {
  optionId: string;
  items: ProposalItem[];
  mode: "homeowner" | "contractor";
  token: string;
  locked: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const included = items.every((i) => i.included);
  const amount = items.filter((i) => i.included).reduce((sum, i) => sum + i.qty * i.unit_price, 0);
  const full = items.reduce((sum, i) => sum + i.qty * i.unit_price, 0);
  async function toggle(on: boolean) {
    for (const item of items) {
      await reviseProposalPublic({ data: { token, itemId: item.id, included: on } });
    }
    onChanged();
  }
  return (
    <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-4"
            checked={included}
            disabled={locked || mode !== "homeowner"}
            onChange={(e) => void toggle(e.target.checked)}
          />
          <span>
            <span className="block font-medium">{optionLabel(optionId)}</span>
            <span className="block text-sm text-muted-foreground">
              {items.length} line{items.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              className="mt-1 text-sm text-primary underline-offset-2 hover:underline"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Hide details" : "See details"}
            </button>
          </span>
        </label>
        <p className="font-medium tabular-nums">{money(included ? amount : full)}</p>
      </div>
      {open && (
        <ul className="mt-4 space-y-3 border-l-2 border-border pl-4">
          {items.map((item) => (
            <ProposalLine
              key={item.id}
              item={item}
              mode={mode}
              token={token}
              locked={locked}
              hideInclude
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ProposalLine({
  item,
  mode,
  token,
  locked,
  hideInclude = false,
  onChanged,
}: {
  item: ProposalItem;
  mode: "homeowner" | "contractor";
  token: string;
  locked: boolean;
  hideInclude?: boolean;
  onChanged: () => void;
}) {
  const [note, setNote] = useState(item.homeowner_note ?? "");
  const line = item.qty * item.unit_price;
  return (
    <li
      className={cn(
        "rounded-xl bg-card p-4 shadow-[var(--shadow-border)]",
        !item.included && "opacity-60",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{item.name}</h3>
            {item.optional && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Optional
              </span>
            )}
          </div>
          {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
          <p className="text-xs text-muted-foreground">
            {item.qty} {item.unit}
            {item.manufacturer ? ` · ${item.manufacturer}` : ""}
            {item.product_name ? ` ${item.product_name}` : ""}
            {item.color ? ` · ${item.color}` : ""}
            {item.sku ? ` · ${item.sku}` : ""}
            {mode === "contractor" && item.unit_cost != null
              ? ` · cost ${money(item.unit_cost)}`
              : ""}
          </p>
          {item.warranty_terms && (
            <p className="text-xs text-primary">
              Warranty
              {item.warranty_years ? ` · ${item.warranty_years} yr` : ""} — {item.warranty_terms}
            </p>
          )}
        </div>
        <p className="font-medium tabular-nums">{money(line)}</p>
      </div>

      {mode === "homeowner" && !locked && (
        <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
          {item.optional && !hideInclude && (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.included}
                onChange={async (e) => {
                  await reviseProposalPublic({
                    data: { token, itemId: item.id, included: e.target.checked },
                  });
                  onChanged();
                }}
              />
              Include this line
            </label>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={note}
              placeholder={
                item.color
                  ? `Keep ${item.color}, or name a different color`
                  : "Ask for a change on this line"
              }
              onChange={(e) => setNote(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await reviseProposalPublic({
                  data: { token, itemId: item.id, homeownerNote: note },
                });
                toast.success("Note saved");
                onChanged();
              }}
            >
              Save note
            </Button>
          </div>
        </div>
      )}

      {mode === "contractor" && item.homeowner_note && (
        <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm">
          Homeowner: {item.homeowner_note}
        </p>
      )}
    </li>
  );
}

function AddLine({ proposalId, onChanged }: { proposalId: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("ls");
  const add = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name the line");
      await upsertProposalItem({
        data: {
          proposalId,
          name,
          description: "",
          qty: Number(qty) || 1,
          unit,
          unitPrice: Number(price) || 0,
          optional: false,
          manufacturer: "",
          productName: "",
          color: "",
          warrantyYears: null,
          warrantyTerms: "",
        },
      });
    },
    onSuccess: () => {
      setName("");
      setPrice("0");
      setOpen(false);
      toast.success("Line added");
      onChanged();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add"),
  });
  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Add a line
      </Button>
    );
  }
  return (
    <div className="grid gap-3 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:grid-cols-4">
      <Input placeholder="Line name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
      <Input placeholder="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
      <Input placeholder="Unit price" value={price} onChange={(e) => setPrice(e.target.value)} />
      <div className="sm:col-span-4 flex gap-2">
        <Button type="button" onClick={() => add.mutate()} disabled={add.isPending}>
          Add
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function MessageForm({
  mode,
  proposalId,
  token,
  onChanged,
}: {
  mode: "homeowner" | "contractor";
  proposalId: string;
  token: string;
  onChanged: () => void;
}) {
  const [body, setBody] = useState("");
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          if (mode === "homeowner") {
            await addHomeownerMessage({ data: { token, body } });
          } else {
            await addContractorMessage({ data: { proposalId, body } });
          }
          setBody("");
          toast.success("Note sent");
          onChanged();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not send");
        }
      }}
    >
      <Label htmlFor="msg">{mode === "homeowner" ? "Request a change" : "Reply"}</Label>
      <Textarea
        id="msg"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          mode === "homeowner"
            ? "Ask about a color, a room, or a product."
            : "Answer the homeowner. Keep it specific."
        }
        rows={3}
      />
      <Button type="submit">Send</Button>
    </form>
  );
}
