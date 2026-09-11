import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Portfolio-home invite-shop discoverability (P0 §4 map-10). */
export function InviteShopHeaderButton({ propertyId }: { propertyId: string }) {
  return (
    <Button asChild>
      <Link to="/manage/$id" params={{ id: propertyId }} hash="invite-shop">
        Invite a shop
      </Link>
    </Button>
  );
}

export function InviteShopHintCard({ propertyId }: { propertyId: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">Invite a shop for an estimate</p>
          <p className="text-sm text-muted-foreground">
            Open any Property Record and send the address to a go-to shop — they quote from the jobs
            already on file.
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link to="/manage/$id" params={{ id: propertyId }} hash="invite-shop">
            Invite a shop
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function QuoteFromHistoryStub() {
  return (
    <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
      <p className="font-medium">Quote from this history</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Prior jobs on this record are what a shop should price against. Invite a go-to shop below for
        an estimate — stub path for demos until the shop sends a real quote.
      </p>
      <Button asChild size="sm" className="mt-3" variant="outline">
        <a href="#invite-shop">Invite a shop to quote</a>
      </Button>
    </div>
  );
}
