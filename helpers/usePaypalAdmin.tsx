import { useQuery } from "@tanstack/react-query";
import { getPaypalStatus } from "../endpoints/admin/paypal/status_GET.schema";

export function usePaypalStatus() {
  return useQuery({
    queryKey: ["admin", "paypal", "status"],
    queryFn: () => getPaypalStatus(),
  });
}