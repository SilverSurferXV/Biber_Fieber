import { useQuery } from "@tanstack/react-query";
import { getAdminCustomerTransactions } from "../endpoints/admin/customer/transactions_GET.schema";

export const useAdminCustomerTransactions = (customerId: number) => {
  return useQuery({
    queryKey: ["adminCustomerTransactions", customerId],
    queryFn: () => getAdminCustomerTransactions({ customerId }),
    enabled: !!customerId,
  });
};