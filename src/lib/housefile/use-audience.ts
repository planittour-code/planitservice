import { useQuery } from "@tanstack/react-query";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getAudience, type Audience } from "@/lib/housefile/server";

const GUEST: Audience = { signedIn: false, kind: "guest", paying: false, homePath: "/" };

export function useAudience() {
  const { user, isPending } = useCurrentUserState();
  const q = useQuery({
    queryKey: ["audience", user?.id ?? "guest"],
    queryFn: () => getAudience(),
    enabled: Boolean(user) && !isPending,
    retry: false,
  });
  const audience = user ? (q.data ?? GUEST) : GUEST;
  return { audience, isPending: isPending || (Boolean(user) && q.isPending) };
}
