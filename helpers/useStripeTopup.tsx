import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postCreatePaymentIntent } from "../endpoints/wallet/create-payment-intent_POST.schema";
import { postConfirmTopup } from "../endpoints/wallet/confirm-topup_POST.schema";
import { AUTH_QUERY_KEY } from "./useAuth";

export const useCreatePaymentIntent = () => {
  return useMutation({
    mutationFn: postCreatePaymentIntent,
  });
};

export const useConfirmTopup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postConfirmTopup,
    onSuccess: () => {
      // Refresh user session data to show updated points balance instantly
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
};