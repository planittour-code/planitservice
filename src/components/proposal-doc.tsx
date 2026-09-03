import { useNavigate } from "@tanstack/react-router";
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
import { StreetView } from "@/components/street-view";
import { Mark } from "@/components/logo";
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
  mode: "homeowner" | "contractor" | "accepted";
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const { proposal, items, property, company, house } = bundle;
  const locked = proposal.status === "completed" || mode === "accepted";
  const includedTotal = items.filter((i) => i.included).reduce((sum, i) => sum + i.qty * i.unit_price, 0);
  const openLines = items.filter((i) => i.included && !lineSettled(i));
  const readyToStart = openLines.length === 0 && items.some((i) => i.included);

  return (
    <article className="space-y-8">
      <header className="space-y-5">
        <div>
          <p className="font-display text-3xl font-medium tracking-tight md:text-4xl">
            {property.homeowner_name}
          </p>
          <p className="mt-1 text-muted-foreground">
            {property.address_line}, {property.city}, {property.state} {property.zip}
          </p>
        </div>

        <EstimateHero bundle={bundle} />

        <div className="flex items-center gap-3">
          {company.logo_src ? (
            <img
              src={company.logo_src}
              alt=""
              className="size-14 shrink-0 rounded-lg object-contain shadow-[var(--shadow-border)]"
            />
          ) : (
            <Mark className="size-14 shrink-0" />
          )}
          <div>
            <p className="text-sm tracking-wide text-muted-foreground uppercase">
              {mode === "homeowner" ? `Estimate from ${company.name}` : company.name}
            </p>
            <p className="font-medium">{proposal.title}</p>
          </div>
        </div>

        {proposal.cover_note ? (
          <p className="max-w-2xl whitespace-pre-wrap text-base leading-relaxed">{proposal.cover_note}</p>
        ) : null}

        {mode === "contractor" && (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={proposal.status} />
            {proposal.sent_at ? (
              <span className="text-sm text-muted-foreground">Sent {shortDate(proposal.sent_at)}</span>
            ) : null}
          </div>
        )}
      </header>

      {mode === "contractor" && !locked && (
        <ContractorMeta bundle={bundle} onChanged={onChanged} />
      )}

      {mode === "homeowner" && !locked && openLines.length > 0 && (
        <AcceptAllBar
          token={proposal.share_token}
          items={openLines}
          onChanged={onChanged}
        />
      )}

      <ul className="space-y-3">
        {items.filter((item) => !item.option_id && !lineSettled(item)).map((item) => (
          <ProposalLine
            key={item.id}
            item={item}
            mode={mode}
            token={proposal.share_token}
            proposalId={proposal.id}
            locked={locked}
            onChanged={onChanged}
          />
        ))}
      </ul>
      {items.some((item) => !item.option_id && lineSettled(item)) ? (
        <div className="space-y-3">
          <h2 className="font-display text-xl font-medium">Accepted lines</h2>
          <ul className="space-y-3">
            {items.filter((item) => !item.option_id && lineSettled(item)).map((item) => (
              <ProposalLine
                key={item.id}
                item={item}
                mode={mode}
                token={proposal.share_token}
                proposalId={proposal.id}
                locked={locked}
                onChanged={onChanged}
              />
            ))}
          </ul>
        </div>
      ) : null}
      <OptionGroups
        items={items}
        mode={mode}
        token={proposal.share_token}
        locked={locked}
        onChanged={onChanged}
      />

      {mode === "contractor" && !locked && <AddLine proposalId={proposal.id} onChanged={onChanged} />}

      {mode === "homeowner" && !locked && openLines.length > 0 && (
        <AcceptAllBar
          token={proposal.share_token}
          items={openLines}
          onChanged={onChanged}
        />
      )}

      <ProposalTotals items={items} showCost={mode === "contractor"} />

      {mode === "contractor" && !locked && (
        <>
          <SectionRule />
          <PhotoGrid file={house} mode={mode} onChanged={onChanged} />
          <SectionRule />
          <MissingFactsPreview file={house} mode={mode} onChanged={onChanged} />
        </>
      )}

      {mode === "homeowner" && (
        <div className="space-y-3 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm tracking-wide text-muted-foreground uppercase">Agreement</p>
              <p className="text-sm text-muted-foreground">
                {readyToStart
                  ? "Every line is accepted. Start work to sign the estimate."
                  : `${openLines.length} line${openLines.length === 1 ? "" : "s"} still need Accept.`}
              </p>
            </div>
            <p className="font-display text-2xl font-medium tabular-nums">{money(includedTotal)}</p>
          </div>
          <Button
            className="min-h-12 w-full"
            disabled={!readyToStart}
            data-preview-ok
            onClick={async () => {
              if (!readyToStart) return;
              try {
                if (proposal.status !== "accepted" && proposal.status !== "completed") {
                  await acceptProposalPublic({ data: { token: proposal.share_token } });
                }
              } catch {
                /* sample or already accepted */
              }
              void navigate({
                to: "/p/$token/accepted",
                params: { token: proposal.share_token },
              });
            }}
          >
            Start Work
          </Button>
        </div>
      )}

      {mode === "accepted" ? (
        <section className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
            <p className="text-sm tracking-wide text-muted-foreground uppercase">Homeowner</p>
            <p className="font-medium">{property.homeowner_name}</p>
            <p className="text-sm text-muted-foreground">Accepted the estimate. Work may begin.</p>
          </div>
          <div className="space-y-2 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
            <p className="text-sm tracking-wide text-muted-foreground uppercase">Contractor</p>
            <p className="font-medium">{company.name}</p>
            <p className="text-sm text-muted-foreground">Estimate from {company.name}.</p>
          </div>
        </section>
      ) : null}

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
            When the work is done, mark it complete. Colors, products, and warranties copy into the property record.
          </p>
          <Button
            onClick={async () => {
              await completeProposal({ data: { proposalId: proposal.id } });
              toast.success("Job written into the property record");
              onChanged();
            }}
          >
            Mark job complete
          </Button>
        </div>
      )}
    </article>
  );
}

function estimateHeroSrc(bundle: ProposalBundle) {
  return (
    bundle.proposal.cover_photo_src ||
    bundle.house.photos.find((p) => p.category === "exterior")?.src ||
    bundle.house.photos[0]?.src ||
    null
  );
}

function EstimateHero({ bundle }: { bundle: ProposalBundle }) {
  const src = estimateHeroSrc(bundle);
  const p = bundle.property;
  if (src) {
    return (
      <img
        src={src}
        alt={p.address_line}
        className="aspect-[16/9] min-h-40 w-full rounded-xl object-cover shadow-[var(--shadow-border)]"
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-xl shadow-[var(--shadow-border)]">
      <StreetView address={p.address_line} city={p.city} state={p.state} zip={p.zip} />
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
  const [photo, setPhoto] = useState<string | null>(bundle.proposal.cover_photo_src ?? null);
  const [drafting, setDrafting] = useState(false);
  const photos = bundle.house.photos;
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
      <div className="space-y-2">
        <Label>Featured photo</Label>
        <p className="text-sm text-muted-foreground">
          Shows at the top of the estimate. If you do not pick one, the map is used.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPhoto(null)}
            className={cn(
              "min-h-11 rounded-md px-3 text-sm shadow-[var(--shadow-border)]",
              photo === null ? "bg-primary text-primary-foreground" : "bg-card",
            )}
          >
            Use the map
          </button>
          {photos.map((ph) => (
            <button
              key={ph.id}
              type="button"
              onClick={() => setPhoto(ph.src)}
              className={cn(
                "overflow-hidden rounded-md shadow-[var(--shadow-border)]",
                photo === ph.src && "ring-2 ring-ring",
              )}
            >
              <img src={ph.src} alt="" className="size-14 object-cover" />
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            await updateProposalMeta({
              data: { id: bundle.proposal.id, title, coverNote: cover, coverPhoto: photo },
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
              data-preview-ok
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
              proposalId={items[0]?.proposal_id ?? ""}
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

function lineSettled(item: ProposalItem) {
  return item.review_status === "accepted" || item.review_status === "change_accepted";
}

function AcceptAllBar({
  token,
  items,
  onChanged,
}: {
  token: string;
  items: ProposalItem[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {items.length} line{items.length === 1 ? "" : "s"} still open.
      </p>
      <Button
        type="button"
        className="min-h-11 w-full sm:w-auto"
        disabled={busy}
        data-preview-ok
        onClick={async () => {
          setBusy(true);
          try {
            for (const item of items) {
              await reviseProposalPublic({
                data: { token, itemId: item.id, reviewStatus: "accepted" },
              });
            }
            toast.success("All lines accepted");
            onChanged();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not accept all");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Accepting…" : "Accept all"}
      </Button>
    </div>
  );
}

function reviewTag(status?: string | null) {
  if (status === "change_review") return "Change Request in Review";
  if (status === "change_accepted") return "Change Request Accepted";
  if (status === "accepted") return "Accepted";
  return null;
}

function ProposalLine({
  item,
  mode,
  token,
  proposalId,
  locked,
  hideInclude = false,
  onChanged,
}: {
  item: ProposalItem;
  mode: "homeowner" | "contractor";
  token: string;
  proposalId: string;
  locked: boolean;
  hideInclude?: boolean;
  onChanged: () => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(item.homeowner_note ?? "");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [qty, setQty] = useState(String(item.qty));
  const [price, setPrice] = useState(String(item.unit_price));
  const line = item.qty * item.unit_price;
  const tag = reviewTag(item.review_status);

  async function acceptLine() {
    await reviseProposalPublic({
      data: { token, itemId: item.id, reviewStatus: "accepted" },
    });
    toast.success("Line accepted");
    onChanged();
  }

  async function saveNote() {
    await reviseProposalPublic({
      data: {
        token,
        itemId: item.id,
        homeownerNote: note,
        reviewStatus: "change_review",
      },
    });
    toast.success("Change request sent");
    setNoteOpen(false);
    onChanged();
  }

  async function saveEdit() {
    await upsertProposalItem({
      data: {
        proposalId,
        itemId: item.id,
        name,
        description,
        qty: Number(qty) || item.qty,
        unit: item.unit,
        unitPrice: Number(price) || item.unit_price,
        optional: item.optional,
        manufacturer: item.manufacturer ?? "",
        productName: item.product_name ?? "",
        color: item.color ?? "",
        warrantyYears: item.warranty_years,
        warrantyTerms: item.warranty_terms ?? "",
      },
    });
    toast.success("Line updated");
    setEditing(false);
    onChanged();
  }

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
            {tag && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                {tag}
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
          {item.homeowner_note ? (
            <p className="text-sm">Note: {item.homeowner_note}</p>
          ) : null}
        </div>
        <p className="font-medium tabular-nums">{money(line)}</p>
      </div>

      {mode === "homeowner" && !locked && !lineSettled(item) && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
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
          {noteOpen ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={note}
                placeholder="What should change on this line"
                onChange={(e) => setNote(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={() => void saveNote()}>
                Save note
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" className="min-h-11 flex-1" onClick={() => void acceptLine()}>
                Accept
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1"
                onClick={() => setNoteOpen(true)}
              >
                Add Note
              </Button>
            </div>
          )}
        </div>
      )}

      {mode === "contractor" && !locked && item.review_status === "change_review" && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {editing ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              <Input value={qty} onChange={(e) => setQty(e.target.value)} />
              <Input value={price} onChange={(e) => setPrice(e.target.value)} />
              <Button type="button" onClick={() => void saveEdit()}>
                Save line
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={() => setEditing(true)}>
              Edit line
            </Button>
          )}
        </div>
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
      <Label htmlFor="msg">{mode === "homeowner" ? "Ask for a change" : "Add a revision note"}</Label>
      <Textarea
        id="msg"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          mode === "homeowner"
            ? "What should change before you accept."
            : "What you changed, and why."
        }
        rows={3}
      />
      <Button type="submit" className="min-h-11">
        {mode === "homeowner" ? "Send to the shop" : "Add to the history"}
      </Button>
    </form>
  );
}
