import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postCancelOrder } from "../endpoints/orders/cancel_POST.schema";
import { AUTH_QUERY_KEY } from "./useAuth";

export const useCancelOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: postCancelOrder,
    onSuccess: () => {
      // Invalidate relevant customer queries to instantly reflect cancelled state and point refund
      queryClient.invalidateQueries({ queryKey: ["customer", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "profile"] });
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
};