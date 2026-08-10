import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postDeleteOrder } from "../endpoints/admin/order/delete_POST.schema";

export const useDeleteAdminOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postDeleteOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
  });
};