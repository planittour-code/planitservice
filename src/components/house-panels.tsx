import { useMutation } from "@tanstack/react-query";
import { Camera, Copy, Mail, Shield } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FIELD_CATALOG, FIELD_GROUPS, PHOTO_CATEGORIES } from "@/lib/housefile/fields";
import { shortDate } from "@/lib/housefile/format";
import { compressImage } from "@/lib/housefile/image";
import { invitationLetter, invitationSubject } from "@/lib/housefile/invite";
import {
  addPhotoContractor,
  addPhotoPublic,
  deletePhotoContractor,
  deletePhotoPublic,
  upsertFactContractor,
  upsertFactPublic,
} from "@/lib/housefile/server";
import type { HouseFile, JobSpec, JobWithSpecs } from "@/lib/housefile/types";
import { cn } from "@/lib/utils";

export function Completeness({ filled, total }: { filled: number; total: number }) {
  const pct = total ? Math.round((filled / total) * 100) : 0;
  return (
    <div className="flex items-center gap-4">
      <div
        className="size-16 shrink-0 rounded-full"
        style={{
          background: `conic-gradient(var(--color-primary) ${pct}%, var(--color-muted) 0)`,
        }}
      >
        <div className="grid size-full place-items-center p-1.5">
          <div className="grid size-full place-items-center rounded-full bg-card text-sm font-medium tabular-nums">
            {pct}%
          </div>
        </div>
      </div>
      <div>
        <p className="font-medium">
          <span className="tabular-nums">{filled}</span> of{" "}
          <span className="tabular-nums">{total}</span> house facts on file
        </p>
        <p className="text-sm text-muted-foreground">
          Missing facts make the next quote slower and less accurate.
        </p>
      </div>
    </div>
  );
}

export function missingFieldLabels(file: HouseFile) {
  const byKey = Object.fromEntries(file.facts.map((f) => [f.field_key, f]));
  return FIELD_CATALOG.filter((f) => !byKey[f.key]?.value);
}

export function MissingChips({
  file,
  limit,
  href,
}: {
  file: HouseFile;
  limit?: number;
  href?: string;
}) {
  const missing = missingFieldLabels(file);
  if (!missing.length) {
    return (
      <p className="text-sm text-muted-foreground">Every catalog field for this house is filled.</p>
    );
  }
  const shown = limit ? missing.slice(0, limit) : missing;
  const rest = missing.length - shown.length;
  const chipClass =
    "inline-flex min-h-8 items-center rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground";
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Still needed for future quotes</p>
      <ul className="flex flex-wrap gap-2">
        {shown.map((f) => (
          <li key={f.key}>
            {href ? (
              <a href={href} className={chipClass}>
                {f.label}
              </a>
            ) : (
              <span className={chipClass}>{f.label}</span>
            )}
          </li>
        ))}
        {rest > 0 && (
          <li className="inline-flex min-h-8 items-center rounded-full px-3 py-1 text-xs text-muted-foreground">
            +{rest} more
          </li>
        )}
      </ul>
    </div>
  );
}

export function PhotoGrid({
  file,
  mode,
  token,
  onChanged,
}: {
  file: HouseFile;
  mode: "homeowner" | "contractor";
  token?: string;
  onChanged: () => void;
}) {
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("exterior");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ file: File; preview: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function commit(fileObj: File, nextCaption: string, nextCategory: string) {
    setBusy(true);
    try {
      const src = await compressImage(fileObj);
      if (mode === "homeowner") {
        if (!token) throw new Error("Missing house token");
        await addPhotoPublic({
          data: { token, src, caption: nextCaption, category: nextCategory },
        });
      } else {
        await addPhotoContractor({
          data: { propertyId: file.property.id, src, caption: nextCaption, category: nextCategory },
        });
      }
      setCaption("");
      toast.success("Photo added to the property record");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add photo");
    } finally {
      setBusy(false);
      setPending((cur) => {
        if (cur?.preview) URL.revokeObjectURL(cur.preview);
        return null;
      });
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onPick(f: File | undefined) {
    if (!f) return;
    const preview = URL.createObjectURL(f);
    setPending({ file: f, preview });
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-medium">Photos</h2>
          <p className="text-sm text-muted-foreground">
            Start here. Add elevations, rooms, and equipment tags. These stay with the address.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {file.photos.map((p) => (
          <figure key={p.id} className="overflow-hidden rounded-lg bg-card shadow-[var(--shadow-border)]">
            <img src={p.src} alt={p.caption || p.category} className="aspect-[4/3] w-full object-cover" />
            <figcaption className="space-y-2 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-foreground">{p.caption || "Untitled"}</span>
                <Badge variant="muted">{p.category}</Badge>
              </div>
              {mode === "homeowner" && token ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 w-full text-xs text-destructive"
                  onClick={async () => {
                    if (!window.confirm("Remove this photo from the record?")) return;
                    try {
                      await deletePhotoPublic({ data: { token, photoId: p.id } });
                      toast.success("Photo removed");
                      onChanged();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not remove");
                    }
                  }}
                >
                  Remove
                </Button>
              ) : mode === "contractor" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 w-full text-xs text-destructive"
                  onClick={async () => {
                    if (!window.confirm("Remove this photo from the record?")) return;
                    try {
                      await deletePhotoContractor({
                        data: { propertyId: file.property.id, photoId: p.id },
                      });
                      toast.success("Photo removed");
                      onChanged();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not remove");
                    }
                  }}
                >
                  Remove
                </Button>
              ) : null}
            </figcaption>
          </figure>
        ))}
        <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/60 px-3 py-6 text-center text-sm text-muted-foreground hover:bg-muted">
          <Camera className="size-5 text-primary" />
          <span>{busy ? "Adding…" : "Add a photo"}</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(e) => onPick(e.target.files?.[0])}
          />
        </label>
      </div>
      {pending && (
        <div className="grid gap-3 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:grid-cols-[8rem_1fr]">
          <img src={pending.preview} alt="" className="aspect-[4/3] w-full rounded-md object-cover" />
          <div className="space-y-3">
            <p className="text-sm font-medium">Caption this photo, then add it to the house.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cap">Caption</Label>
                <Input
                  id="cap"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="South elevation, 2026"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat">Category</Label>
                <select
                  id="cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex h-11 w-full rounded-md bg-background px-3 text-sm shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {PHOTO_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={() => void commit(pending.file, caption, category)}
              >
                {busy ? "Adding…" : "Add to property record"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  URL.revokeObjectURL(pending.preview);
                  setPending(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function FactsPanel({
  file,
  mode,
  token,
  onChanged,
}: {
  file: HouseFile;
  mode: "homeowner" | "contractor";
  token?: string;
  onChanged: () => void;
}) {
  const byKey = Object.fromEntries(file.facts.map((f) => [f.field_key, f]));
  const missing = FIELD_CATALOG.filter((f) => !byKey[f.key]?.value);

  const save = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      if (mode === "homeowner") {
        if (!token) throw new Error("Missing house token");
        await upsertFactPublic({ data: { token, fieldKey: key, value } });
      } else {
        await upsertFactContractor({
          data: { propertyId: file.property.id, fieldKey: key, value },
        });
      }
    },
    onSuccess: () => {
      toast.success("Property Record updated");
      onChanged();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save"),
  });

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-medium">House data</h2>
        <p className="text-sm text-muted-foreground">
          Keep this current. The next quote starts here instead of a clipboard.
        </p>
      </div>

      {missing.length > 0 && (
        <Card className="bg-muted/40">
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium">Missing for future quotes</h3>
              <p className="text-sm text-muted-foreground">
                Fill what you know. Leave the rest — a contractor can add it on site.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {missing.map((field) => (
                <FactInput
                  key={field.key}
                  label={field.label}
                  hint={field.hint}
                  placeholder={field.placeholder}
                  defaultValue=""
                  disabled={save.isPending}
                  onSave={(value) => save.mutate({ key: field.key, value })}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {FIELD_GROUPS.map((group) => {
        const fields = FIELD_CATALOG.filter((f) => f.group === group.id && byKey[f.key]);
        if (!fields.length) return null;
        return (
          <div key={group.id} className="space-y-3">
            <h3 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
              {group.label}
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {fields.map((field) => (
                <FactInput
                  key={`${field.key}-${byKey[field.key]?.value ?? ""}`}
                  label={field.label}
                  hint={field.hint}
                  placeholder={field.placeholder}
                  defaultValue={byKey[field.key]?.value ?? ""}
                  source={byKey[field.key]?.source}
                  disabled={save.isPending}
                  onSave={(value) => save.mutate({ key: field.key, value })}
                />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function MissingFactsPreview({
  file,
  mode,
  token,
  onChanged,
  limit = 6,
}: {
  file: HouseFile;
  mode: "homeowner" | "contractor";
  token?: string;
  onChanged: () => void;
  limit?: number;
}) {
  const missing = missingFieldLabels(file).slice(0, limit);
  const save = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      if (mode === "homeowner") {
        if (!token) throw new Error("Missing house token");
        await upsertFactPublic({ data: { token, fieldKey: key, value } });
      } else {
        await upsertFactContractor({
          data: { propertyId: file.property.id, fieldKey: key, value },
        });
      }
    },
    onSuccess: () => {
      toast.success("Property Record updated");
      onChanged();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save"),
  });
  if (!missing.length) return null;
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-xl font-medium">Missing house data</h2>
        <p className="text-sm text-muted-foreground">
          These are the blanks that slow the next quote. Fill what you know while you have the draft open.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {missing.map((field) => (
          <FactInput
            key={field.key}
            label={field.label}
            hint={field.hint}
            placeholder={field.placeholder}
            defaultValue=""
            disabled={save.isPending}
            onSave={(value) => save.mutate({ key: field.key, value })}
          />
        ))}
      </div>
    </section>
  );
}

function FactInput({
  label,
  hint,
  placeholder,
  defaultValue,
  source,
  disabled,
  onSave,
}: {
  label: string;
  hint: string;
  placeholder: string;
  defaultValue: string;
  source?: string;
  disabled?: boolean;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const dirty = value !== defaultValue;
  return (
    <div className="space-y-1.5 rounded-lg bg-card p-3 shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        {source && (
          <span className="text-xs text-muted-foreground">
            {source === "homeowner" ? "You" : "Contractor"}
          </span>
        )}
      </div>
      <Input
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (dirty) onSave(value);
        }}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function JobTimeline({ file }: { file: HouseFile }) {
  if (!file.jobs.length) {
    return (
      <section className="space-y-2">
        <h2 className="font-display text-xl font-medium">Jobs at this address</h2>
        <p className="text-sm text-muted-foreground">No completed jobs yet. Accepted work will land here.</p>
      </section>
    );
  }
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-medium">Jobs at this address</h2>
        <p className="text-sm text-muted-foreground">
          Colors, products, and measurements stay with the house.
        </p>
      </div>
      <ol className="space-y-4">
        {file.jobs.map((job) => (
          <li key={job.id} className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-lg font-medium">{job.title}</h3>
              <time className="text-sm text-muted-foreground">{shortDate(job.completed_at)}</time>
            </div>
            {job.summary && <p className="mt-1 text-sm text-muted-foreground">{job.summary}</p>}
            {job.specs.length > 0 && (
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {job.specs.map((spec) => (
                  <div key={spec.id} className="rounded-md bg-muted/60 px-3 py-2">
                    <dt className="text-xs tracking-wide text-muted-foreground uppercase">{spec.label}</dt>
                    <dd className="text-sm font-medium">{spec.value}</dd>
                    {spec.location_note && (
                      <dd className="text-xs text-muted-foreground">{spec.location_note}</dd>
                    )}
                    {spec.manufacturer && (
                      <dd className="text-xs text-muted-foreground">
                        {spec.manufacturer}
                        {spec.product_name ? ` · ${spec.product_name}` : ""}
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function PreviousJobsStrip({ jobs }: { jobs: JobWithSpecs[] }) {
  if (!jobs.length) return null;
  return (
    <aside className="rounded-xl bg-muted/50 px-4 py-3">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">
        Previous work at this address
      </p>
      <ul className="mt-2 space-y-1">
        {jobs.map((job) => (
          <li key={job.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">{job.title}</span>
            <time className="text-muted-foreground">{shortDate(job.completed_at)}</time>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function WarrantyList({ file }: { file: HouseFile }) {
  const items: (JobSpec & { jobTitle: string; completed: string })[] = [];
  for (const job of file.jobs) {
    for (const spec of job.specs) {
      if (spec.warranty_terms || spec.warranty_years) {
        items.push({ ...spec, jobTitle: job.title, completed: job.completed_at });
      }
    }
  }
  if (!items.length) {
    return (
      <section className="space-y-2">
        <h2 className="font-display text-xl font-medium">Manufacturer warranties</h2>
        <p className="text-sm text-muted-foreground">
          When a job is marked complete, product warranties are copied here.
        </p>
      </section>
    );
  }
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <Shield className="mt-1 size-5 text-primary" />
        <div>
          <h2 className="font-display text-xl font-medium">Manufacturer warranties</h2>
          <p className="text-sm text-muted-foreground">
            Tied to this address, not a PDF in a drawer.
          </p>
        </div>
      </div>
      <ul className="space-y-3">
        {items.map((w) => (
          <li key={w.id} className="rounded-lg bg-card px-4 py-3 shadow-[var(--shadow-border)]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">
                {w.manufacturer ? `${w.manufacturer} ` : ""}
                {w.product_name || w.label}
              </p>
              {w.warranty_expires ? (
                <span className="text-sm tabular-nums text-muted-foreground">
                  Through {shortDate(w.warranty_expires)}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">See terms</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{w.warranty_terms}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              From {w.jobTitle} · {shortDate(w.completed)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function absoluteUrl(path: string) {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function CopyLink({ path, label }: { path: string; label: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(absoluteUrl(path));
        toast.success("Link copied");
      }}
    >
      <Copy className="size-3.5" />
      {label}
    </Button>
  );
}

export function InvitationLetter({
  email,
  name,
  address,
  company,
  invitePath,
  housePath,
  proposalPath,
}: {
  email: string;
  name: string;
  address: string;
  company: string;
  invitePath: string;
  housePath: string;
  proposalPath?: string;
}) {
  const inviteUrl = absoluteUrl(invitePath);
  const proposalUrl = proposalPath ? absoluteUrl(proposalPath) : undefined;
  const body = invitationLetter({
    name,
    address,
    company,
    inviteUrl,
    proposalUrl,
  });
  const subject = invitationSubject(company, address);

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Invitation</p>
          <p className="font-medium">To {name}</p>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/60 px-4 py-3 font-sans text-sm leading-relaxed">
          {body}
        </pre>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            }}
          >
            <Mail className="size-3.5" />
            Open in email
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(body);
              toast.success("Invitation copied");
            }}
          >
            <Copy className="size-3.5" />
            Copy invitation
          </Button>
          <CopyLink path={invitePath} label="Copy house account" />
          {proposalPath && <CopyLink path={proposalPath} label="Copy first draft" />}
          <CopyLink path={housePath} label="Copy property record" />
        </div>
      </CardContent>
    </Card>
  );
}

export function InviteMail({
  email,
  name,
  address,
  company,
  housePath,
  proposalPath,
  invitePath,
}: {
  email: string;
  name: string;
  address: string;
  company: string;
  housePath: string;
  proposalPath?: string;
  invitePath?: string;
}) {
  return (
    <Button
      type="button"
      onClick={() => {
        const inviteUrl = absoluteUrl(invitePath || housePath);
        const proposalUrl = proposalPath ? absoluteUrl(proposalPath) : undefined;
        const subject = encodeURIComponent(invitationSubject(company, address));
        const body = encodeURIComponent(
          invitationLetter({ name, address, company, inviteUrl, proposalUrl }),
        );
        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
      }}
    >
      <Mail className="size-3.5" />
      Email the invitation
    </Button>
  );
}

export function SectionRule({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />;
}
