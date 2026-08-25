import { Badge } from "@/components/ui/badge";
import { statusLabel } from "@/lib/housefile/format";

export function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "revised" || status === "draft" || status === "pending"
      ? "warning"
      : status === "completed"
        ? "muted"
        : status === "accepted" || status === "sent"
          ? "default"
          : "outline";
  return <Badge variant={variant}>{statusLabel(status)}</Badge>;
}
