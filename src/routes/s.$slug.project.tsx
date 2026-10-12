import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PublicHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPublicShop, startPublicProject } from "@/lib/housefile/server";
import { workTypesFor } from "@/lib/housefile/quote";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/s/$slug/project")({ component: ShopProject });

function ShopProject() {
  const { slug } = Route.useParams();
  const shop = useQuery({
    queryKey: ["public-shop", slug],
    queryFn: () => getPublicShop({ data: slug }),
    retry: false,
  });
  const shopName = shop.data?.name ?? "This shop";
  const offered = workTypesFor((shop.data?.trades ?? []).join(","));
  const [workId, setWorkId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("GA");
  const [zip, setZip] = useState("");
  const [opened, setOpened] = useState<{ inviteUrl: string; work: string } | null>(null);

  const save = useMutation({
    mutationFn: () =>
      startPublicProject({
        data: { slug, name, email, phone, addressLine, city, state, zip, workId },
      }),
    onSuccess: (res) => {
      setOpened({ inviteUrl: res.inviteUrl, work: res.work });
      toast.success(`${shopName} has your request.`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not send the request."),
  });

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader compact path="public">
        <Button asChild variant="outline" size="sm">
          <Link to="/s/$slug" params={{ slug }}>
            {shopName}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/s/$slug/book" params={{ slug }}>
            Schedule Today
          </Link>
        </Button>
      </PublicHeader>
      <main className="mx-auto max-w-xl space-y-6 px-4 py-8 sm:px-6">
        <div className="space-y-2">
          <p className="text-sm font-medium tracking-wide text-primary">{shopName}</p>
          <h1 className="font-display text-3xl font-medium tracking-tight">Request an estimate</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Pick the work, give the address, and {shopName} will build a quote from what you send.
          </p>
        </div>
        {shop.error ? (
          <p className="text-sm text-destructive">This shop link is not live yet.</p>
        ) : opened ? (
          <section className="space-y-3 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-xl font-medium">{opened.work} request sent</h2>
            <p className="text-sm text-muted-foreground">
              {shopName} has the job details and will follow up with an estimate.
            </p>
            <Button asChild>
              <a href={opened.inviteUrl}>View this request</a>
            </Button>
          </section>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Work {shopName} offers</legend>
              {offered.length === 0 ? (
                <p className="text-sm text-muted-foreground">This shop has not published categories yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {offered.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setWorkId(item.id)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-sm shadow-[var(--shadow-border)]",
                        workId === item.id ? "bg-primary text-primary-foreground" : "bg-card",
                      )}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              )}
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="address">Street address</Label>
                <Input id="address" value={addressLine} onChange={(e) => setAddressLine(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" value={state} onChange={(e) => setState(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="zip">ZIP</Label>
                  <Input id="zip" value={zip} onChange={(e) => setZip(e.target.value)} />
                </div>
              </div>
            </div>
            <Button type="submit" disabled={save.isPending || shop.isLoading || !workId}>
              {save.isPending ? "Sending…" : "Send request"}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
