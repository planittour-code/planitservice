import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { shortDate } from "@/lib/housefile/format";
import { WORK_TYPES } from "@/lib/housefile/quote";
import { closeRfp, createRfp, getHomeownerAccount } from "@/lib/housefile/server";
import type { Rfp } from "@/lib/housefile/types";

export function workLabel(id: string) {
  return WORK_TYPES.find((w) => w.id === id)?.name ?? id;
}

export function RfpForm({
  houseToken,
  addressLine,
  city,
  state,
  zip,
  homeownerName,
  onCreated,
}: {
  houseToken?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  zip?: string;
  homeownerName?: string;
  onCreated?: (rfp: Rfp) => void;
}) {
  const { user } = useCurrentUserState();
  const navigate = useNavigate();
  const [workId, setWorkId] = useState("roof");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [budget, setBudget] = useState("");
  const [addr, setAddr] = useState(addressLine ?? "");
  const [town, setTown] = useState(city ?? "");
  const [st, setSt] = useState(state ?? "GA");
  const [postal, setPostal] = useState(zip ?? "");
  const save = useMutation({
    mutationFn: () =>
      createRfp({
        data: {
          houseToken,
          workId,
          title,
          body,
          budget,
          addressLine: addr,
          city: town,
          state: st,
          zip: postal,
          homeownerName,
        },
      }),
    onSuccess: (rfp) => {
      toast.success("Request is on the market");
      onCreated?.(rfp);
      void navigate({ to: "/rfp/$token", params: { token: rfp.share_token } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not post"),
  });

  if (!user) {
    return (
      <p className="text-sm text-muted-foreground">
        <Link to="/login" search={{ next: "/homeowners", role: "homeowner" }} className="underline">
          Start Pro
        </Link>{" "}
        to put this job on the market.
      </p>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="trade">Trade</Label>
        <select
          id="trade"
          value={workId}
          onChange={(e) => setWorkId(e.target.value)}
          className="flex h-11 w-full rounded-md bg-card px-3 text-sm shadow-[var(--shadow-border)] outline-none"
        >
          {WORK_TYPES.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rfp-title">The job</Label>
        <Input
          id="rfp-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Reroof before storm season"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rfp-body">What shops need to know</Label>
        <Textarea
          id="rfp-body"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Squares, pitch, access, product you want named on the Property Record."
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rfp-budget">Budget (optional)</Label>
        <Input
          id="rfp-budget"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="Under 18,000"
        />
      </div>
      {!houseToken && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="rfp-addr">Address</Label>
            <Input id="rfp-addr" value={addr} onChange={(e) => setAddr(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rfp-city">City</Label>
            <Input id="rfp-city" value={town} onChange={(e) => setTown(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rfp-st">State</Label>
              <Input id="rfp-st" value={st} onChange={(e) => setSt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rfp-zip">ZIP</Label>
              <Input id="rfp-zip" value={postal} onChange={(e) => setPostal(e.target.value)} />
            </div>
          </div>
        </div>
      )}
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? "Posting…" : "Put it on the market"}
      </Button>
    </form>
  );
}

export function RfpList({ houseToken }: { houseToken?: string }) {
  const { user } = useCurrentUserState();
  const q = useQuery({
    queryKey: ["homeowner-account"],
    queryFn: () => getHomeownerAccount(),
    enabled: Boolean(user),
  });
  const close = useMutation({
    mutationFn: (token: string) => closeRfp({ data: token }),
    onSuccess: () => void q.refetch(),
  });
  const rfps = (q.data?.rfps ?? []).filter((r) =>
    houseToken ? true : true,
  );

  if (!user) return null;
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading requests…</p>;
  if (rfps.length === 0) {
    return <p className="text-sm text-muted-foreground">No requests on the market yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {rfps.map((rfp) => (
        <li
          key={rfp.id}
          className="flex flex-col gap-2 rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)] sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-medium">{rfp.title}</p>
            <p className="text-sm text-muted-foreground">
              {workLabel(rfp.work_id)} · {rfp.status} · {shortDate(rfp.created_at)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm">
              <Link to="/rfp/$token" params={{ token: rfp.share_token }}>
                Open
              </Link>
            </Button>
            {rfp.status === "open" && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => close.mutate(rfp.share_token)}
              >
                Close
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
