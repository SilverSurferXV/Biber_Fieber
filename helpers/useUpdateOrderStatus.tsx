import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postUpdateOrderStatus, InputType, OutputType } from "../endpoints/admin/order/status_POST.schema";

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation<OutputType, Error, InputType>({
    mutationFn: (variables) => postUpdateOrderStatus(variables),
    onSuccess: () => {
      // Invalidate the admin orders list query to reflect the updated status
      // Note: adjust the query key based on your actual orders fetch query key
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
  });
}