import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboard, listShopIndex, sendRepeatServiceCampaign } from "@/lib/housefile/server";
import { workTypesFor } from "@/lib/housefile/quote";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/campaign")({ component: CampaignPage });

function CampaignPage() {
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const index = useQuery({ queryKey: ["shop-index"], queryFn: () => listShopIndex() });
  const offered = workTypesFor(dash.data?.company.trades);
  const [repeatId, setRepeatId] = useState("");
  const [extra, setExtra] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const clients = useMemo(() => {
    const list = index.data?.clients ?? [];
    return list.filter((c) => c.email.includes("@") && c.houses.length > 0);
  }, [index.data?.clients]);

  const selectedIds = useMemo(() => {
    const set = new Set(picked);
    return clients
      .filter((c) => set.has(c.key))
      .flatMap((c) => c.houses.map((h) => h.id));
  }, [clients, picked]);

  const repeat = offered.find((w) => w.id === repeatId) ?? offered[0];
  const extraNames = extra
    .map((id) => offered.find((w) => w.id === id)?.name)
    .filter((n): n is string => Boolean(n));

  const send = useMutation({
    mutationFn: () =>
      sendRepeatServiceCampaign({
        data: {
          propertyIds: selectedIds,
          repeatWork: repeat?.name ?? "service",
          extraWork: extraNames,
          note,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        res.emailed
          ? `Sent ${res.emailed} ${res.emailed === 1 ? "email" : "emails"}${res.skipped ? ` · ${res.skipped} skipped` : ""}`
          : "No emails sent. Need a customer email on the File.",
      );
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not send"),
  });

  if (dash.isLoading || index.isLoading) return <Skeleton className="h-64 w-full" />;
  if (dash.data?.role && dash.data.role !== "owner") {
    return (
      <p className="text-sm text-muted-foreground">
        Only the shop owner can email previous customers. Ask them to send the campaign.
      </p>
    );
  }

  function toggleClient(key: string) {
    setPicked((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  }

  function toggleExtra(id: string) {
    if (id === (repeat?.id ?? "")) return;
    setExtra((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm tracking-wide text-muted-foreground uppercase">Past customers</p>
        <h1 className="font-display text-3xl font-medium tracking-tight">Schedule the next visit</h1>
        <p className="mt-2 text-muted-foreground">
          Email people you already worked. Offer the same service again, then the other categories
          this shop offers. They open the File, keep the record, and book you — or Request Estimates
          if they want other bids.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Repeat service</legend>
        {offered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Pick the categories this shop offers in settings first. Campaigns only cover that work.
          </p>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          {offered.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                setRepeatId(w.id);
                setExtra((cur) => cur.filter((id) => id !== w.id));
              }}
              className={cn(
                "rounded-lg p-3 text-left shadow-[var(--shadow-border)]",
                (repeat?.id ?? "") === w.id ? "bg-primary text-primary-foreground" : "bg-card",
              )}
            >
              <p className="font-medium">{w.name}</p>
            </button>
          ))}
        </div>
      </fieldset>

      {offered.length > 1 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Also offer</legend>
          <p className="text-sm text-muted-foreground">
            Other work this shop does at the same address.
          </p>
          <div className="flex flex-wrap gap-2">
            {offered
              .filter((w) => w.id !== repeat?.id)
              .map((w) => {
                const on = extra.includes(w.id);
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggleExtra(w.id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm shadow-[var(--shadow-border)]",
                      on ? "bg-primary text-primary-foreground" : "bg-card",
                    )}
                  >
                    {w.name}
                  </button>
                );
              })}
          </div>
        </fieldset>
      )}

      <div className="space-y-1">
        <Label htmlFor="note">Note (optional)</Label>
        <Textarea
          id="note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Leaf season is coming. We still have openings in October."
        />
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-medium">Who to email</h2>
            <p className="text-sm text-muted-foreground">
              {picked.length} selected · {selectedIds.length}{" "}
              {selectedIds.length === 1 ? "house" : "houses"}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setPicked(picked.length === clients.length ? [] : clients.map((c) => c.key))
            }
          >
            {picked.length === clients.length ? "Clear" : "Select all with email"}
          </Button>
        </div>
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add an email on the File when you quote. Then those customers show up here.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl bg-card shadow-[var(--shadow-border)]">
            {clients.map((client) => {
              const on = picked.includes(client.key);
              return (
                <li key={client.key}>
                  <label className="flex cursor-pointer items-start gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      className="mt-1 size-4"
                      checked={on}
                      onChange={() => toggleClient(client.key)}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{client.name}</span>
                      <span className="block text-sm text-muted-foreground">
                        {client.email} · {client.houses.map((h) => h.address_line).join(" · ")}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Button
        type="button"
        className="w-full"
        disabled={send.isPending || !selectedIds.length || !repeat}
        onClick={() => send.mutate()}
      >
        {send.isPending ? "Sending…" : `Email ${picked.length || "selected"} customers`}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        They keep the File (Standard). Request Estimates is Pro if they want other shops.
      </p>
      <p className="text-center text-sm">
        <Link to="/app/properties" search={{ view: "clients" }} className="underline underline-offset-2">
          Back to clients
        </Link>
      </p>
    </div>
  );
}
