import { useQuery } from "@tanstack/react-query";
import { getCustomerDonationReceipt } from "../endpoints/customer/donation-receipt_GET.schema";

export function useCustomerDonationReceipt(month: string) {
  return useQuery({
    queryKey: ["customer", "donation-receipt", month],
    queryFn: async () => {
      if (!month) throw new Error("Month is required");
      const data = await getCustomerDonationReceipt({ month });
      return data;
    },
    enabled: !!month,
  });
}