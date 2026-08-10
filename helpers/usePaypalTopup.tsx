import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postCreatePaypalOrder } from "../endpoints/wallet/paypal/create-order_POST.schema";
import { postCapturePaypalOrder } from "../endpoints/wallet/paypal/capture-order_POST.schema";
import { AUTH_QUERY_KEY } from "./useAuth";

export const useCreatePaypalOrder = () => {
  return useMutation({
    mutationFn: postCreatePaypalOrder,
  });
};

export const useCapturePaypalOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postCapturePaypalOrder,
    onSuccess: () => {
      // Refresh user session data to show updated points balance instantly
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
};