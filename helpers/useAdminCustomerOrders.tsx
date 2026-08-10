import { useQuery } from "@tanstack/react-query";
import { getAdminCustomerOrders } from "../endpoints/admin/customer/orders_GET.schema";

export const useAdminCustomerOrders = (customerId: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["admin", "customer", "orders", customerId],
    queryFn: () => getAdminCustomerOrders({ customerId }),
    enabled: enabled && !isNaN(customerId),
  });
};