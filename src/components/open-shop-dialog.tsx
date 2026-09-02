import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function OpenShopDialog({
  open,
  onClose,
  workName,
  next,
}: {
  open: boolean;
  onClose: () => void;
  workName?: string;
  next: string;
}) {
  const label = workName ?? "this";
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-card p-6 shadow-[var(--shadow-border-hover)] focus:outline-none">
          <Dialog.Title className="font-display text-2xl font-medium tracking-tight">
            Open a shop to quote {label}.
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
            You can look around. Sending a number, saving a Property Record, and the price book are for shops.
          </Dialog.Description>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button asChild className="flex-1">
              <Link to="/shop/open">
                Open a shop
              </Link>
            </Button>
            <Dialog.Close asChild>
              <Button type="button" variant="outline" className="flex-1">
                Keep looking
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
