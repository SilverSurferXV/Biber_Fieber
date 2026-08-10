import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDeliveryFeedbackPending } from "../endpoints/delivery-feedback/pending_GET.schema";
import { postDeliveryFeedbackSubmit, schema as submitSchema } from "../endpoints/delivery-feedback/submit_POST.schema";
import { useAuth } from "./useAuth";
import { z } from "zod";

export const DELIVERY_FEEDBACK_PENDING_QUERY_KEY = ["delivery-feedback", "pending"] as const;

export function useDeliveryFeedbackPending() {
  const { authState } = useAuth();

  return useQuery({
    queryKey: DELIVERY_FEEDBACK_PENDING_QUERY_KEY,
    queryFn: () => getDeliveryFeedbackPending(),
    // Only fetch if authenticated as a normal user
            enabled: authState.type === "authenticated" && authState.user.role === "user",
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useSubmitDeliveryFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: z.infer<typeof submitSchema>) => postDeliveryFeedbackSubmit(data),
    onSuccess: () => {
      // Invalidate the pending feedbacks query to hide the completed one
      queryClient.invalidateQueries({
        queryKey: DELIVERY_FEEDBACK_PENDING_QUERY_KEY,
      });
      // Also invalidate auth query since points balance might have changed due to tipping
      queryClient.invalidateQueries({
        queryKey: ["auth", "session"],
      });
    },
  });
}