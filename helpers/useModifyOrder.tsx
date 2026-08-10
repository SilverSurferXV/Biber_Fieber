import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postModifyOrder, schema } from "../endpoints/orders/modify_POST.schema";
import { z } from "zod";
import { AUTH_QUERY_KEY } from "./useAuth";

export const useModifyOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof schema>) => {
      const result = await postModifyOrder(data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "profile"] });
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
};