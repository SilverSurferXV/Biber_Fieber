import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postAdminProductReorder, InputType } from "../endpoints/admin/product/reorder_POST.schema";

export const useAdminProductReorder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InputType) => {
      return await postAdminProductReorder(data);
    },
    onSuccess: () => {
      // Invalidate products query to refetch updated order
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
};