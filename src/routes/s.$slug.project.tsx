import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PublicHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROJECT_SERVICES } from "@/lib/housefile/calendar";
import { getPublicShop, startPublicProject } from "@/lib/housefile/server";
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
  const [workId, setWorkId] = useState<(typeof PROJECT_SERVICES)[number]["id"]>("gutters");
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
      toast.success(`Property Record opened. ${shopName} has the request.`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not open the file."),
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
          <h1 className="font-display text-3xl font-medium tracking-tight">Start a new project</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Tell us the work and the address. We open a Property Record for free and send the
            request to {shopName}. After you accept the estimate and start work, the file stays
            free for 30 days, then continues at $7.99 a month if you want to keep it.
          </p>
        </div>
        {shop.error ? (
          <p className="text-sm text-destructive">This shop link is not live yet.</p>
        ) : opened ? (
          <section className="space-y-3 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-xl font-medium">{opened.work} request sent</h2>
            <p className="text-sm text-muted-foreground">
              Sign in with the email you just used to claim the file.
            </p>
            <Button asChild>
              <a href={opened.inviteUrl}>Open the Property Record</a>
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
              <legend className="text-sm font-medium">Work</legend>
              <div className="flex flex-wrap gap-2">
                {PROJECT_SERVICES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setWorkId(item.id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm shadow-[var(--shadow-border)]",
                      workId === item.id ? "bg-primary text-primary-foreground" : "bg-card",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
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
            <Button type="submit" disabled={save.isPending || shop.isLoading}>
              {save.isPending ? "Opening the file…" : "Start a New Project"}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
