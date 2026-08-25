import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { postStartRedirectTopup } from "../endpoints/wallet/redirect-payment/start_POST.schema";
import { postRedirectTopupStatus } from "../endpoints/wallet/redirect-payment/status_POST.schema";
import { AUTH_QUERY_KEY } from "./useAuth";
import { CUSTOMER_POINT_HISTORY_QUERY_KEY } from "./useCustomerPointHistory";
import { useEffect } from "react";

export const useStartRedirectTopup = () => {
  return useMutation({
    mutationFn: postStartRedirectTopup,
  });
};

export const useRedirectTopupStatus = ({
  paymentIntentId,
  amount,
  paymentMethod,
  enabled,
}: {
  paymentIntentId: string;
  amount: 15 | 25 | 50 | 100 | 200 | 500;
  paymentMethod: any;
  enabled: boolean;
}) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["redirect-topup-status", paymentIntentId],
    queryFn: async () => {
      if (!paymentIntentId) throw new Error("No payment intent ID");
      return postRedirectTopupStatus({ paymentIntentId, amount, paymentMethod });
    },
    enabled: !!paymentIntentId && enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === "succeeded" || data.status === "canceled")) {
        return false; // Stop polling on final states
      }
      return 3000; // Poll every 3s otherwise
    },
    retry: false,
  });

  useEffect(() => {
    // Automatically invalidate global wallet and history states once successfully credited
    if (query.data?.credited) {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CUSTOMER_POINT_HISTORY_QUERY_KEY });
    }
  }, [query.data?.credited, queryClient]);

  return query;
};