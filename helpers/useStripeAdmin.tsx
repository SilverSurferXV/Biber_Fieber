import { useQuery } from "@tanstack/react-query";
import { getStripeStatus } from "../endpoints/admin/stripe/status_GET.schema";
import { getStripeTopups } from "../endpoints/admin/stripe/topups_GET.schema";

export function useStripeStatus() {
  return useQuery({
    queryKey: ["admin", "stripe", "status"],
    queryFn: () => getStripeStatus(),
  });
}

export function useStripeTopups() {
  return useQuery({
    queryKey: ["admin", "stripe", "topups"],
    queryFn: () => getStripeTopups(),
  });
}