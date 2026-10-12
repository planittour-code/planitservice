import { useQuery } from "@tanstack/react-query";
import { checkAddressClaimed } from "@/lib/housefile/server";

export function useAddressClaimed(addressLine: string, zip?: string) {
  const street = addressLine.trim();
  const zip5 = (zip ?? "").trim().slice(0, 5);
  const q = useQuery({
    queryKey: ["address-claimed", street.toLowerCase(), zip5],
    queryFn: () => checkAddressClaimed({ data: { addressLine: street, zip: zip5 } }),
    enabled: street.length >= 4,
    staleTime: 15_000,
  });
  return Boolean(q.data?.claimed);
}
