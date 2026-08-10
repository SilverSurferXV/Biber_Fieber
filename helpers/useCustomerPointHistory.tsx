import { useQuery } from "@tanstack/react-query";
import { getCustomerPointHistory } from "../endpoints/customer/point-history_GET.schema";

export const CUSTOMER_POINT_HISTORY_QUERY_KEY = ["customer", "point-history"] as const;

export function useCustomerPointHistory() {
  return useQuery({
    queryKey: CUSTOMER_POINT_HISTORY_QUERY_KEY,
    queryFn: () => getCustomerPointHistory(),
  });
}