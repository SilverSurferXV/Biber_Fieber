import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postApplyBibercode } from "../endpoints/customer/apply-bibercode_POST.schema";
import { AUTH_QUERY_KEY } from "./useAuth";

export const useApplyBibercodeMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postApplyBibercode,
    onSuccess: () => {
      // Invalidate auth query to ensure the updated user profile (with the applied bibercode) is fetched
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
};