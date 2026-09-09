import { Badge } from "@/components/ui/badge";
import { statusLabel } from "@/lib/housefile/format";
import {
  maintenanceStatusLabel,
  type MaintenanceStatus,
} from "@/lib/housefile/maintain";

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

export function MaintenanceBadge({ status }: { status: MaintenanceStatus }) {
  const variant =
    status === "overdue"
      ? "warning"
      : status === "dueSoon"
        ? "default"
        : status === "scheduled"
          ? "outline"
          : "muted";
  return <Badge variant={variant}>{maintenanceStatusLabel(status)}</Badge>;
}
