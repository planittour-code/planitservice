import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CustomWorkDialog } from "@/components/custom-work-dialog";
import { TradeGrid } from "@/components/trade-face";
import { SHOP_MONTHLY, dollars } from "@/lib/housefile/pricing";
import { WORK_TYPES, type WorkType, workTypesFor } from "@/lib/housefile/quote";
import { addCustomWork, getDashboard } from "@/lib/housefile/server";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function QuoteTypePicker({
  onPick,
  title = "What are you quoting?",
  hint = "The Property Record is often a start. A painter may have opened it. A roof still needs its own takeoff.",
  types,
}: {
  onPick: (workId: string) => void;
  title?: string;
  hint?: string;
  types?: WorkType[];
}) {
  const { user } = useCurrentUserState();
  const dash = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
    enabled: Boolean(user) && !types,
  });
  const offered =
    types ??
    (user ? workTypesFor(dash.data?.company.trades) : WORK_TYPES);
  const [adding, setAdding] = useState(false);
  const addWork = useMutation({
    mutationFn: (name: string) => addCustomWork({ data: { name } }),
    onSuccess: (res) => {
      setAdding(false);
      void dash.refetch();
      onPick(res.workId);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add category"),
  });
  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      {offered.length ? (
        <TradeGrid
          types={offered}
          onPick={onPick}
          compact
          onAddCustom={user ? () => setAdding(true) : undefined}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          This shop has not chosen categories yet. Add the work you offer in shop settings — $
          {dollars(SHOP_MONTHLY)}/month each — then quote from those.
        </p>
      )}
      <CustomWorkDialog
        open={adding}
        onClose={() => setAdding(false)}
        onSave={(name) => {
          void addWork.mutateAsync(name);
        }}
        busy={addWork.isPending}
      />
    </div>
  );
}
