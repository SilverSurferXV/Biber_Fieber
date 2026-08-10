import { useQuery } from "@tanstack/react-query";
import { getCustomerReferrals } from "../endpoints/customer/referrals_GET.schema";
import { useAuth } from "./useAuth";

export const CUSTOMER_REFERRALS_QUERY_KEY = ["customer", "referrals"] as const;

export function useCustomerReferrals() {
  const { authState } = useAuth();

  return useQuery({
    queryKey: CUSTOMER_REFERRALS_QUERY_KEY,
    queryFn: () => getCustomerReferrals(),
    enabled: authState.type === "authenticated",
  });
}