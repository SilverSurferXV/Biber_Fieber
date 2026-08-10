import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPendingNotifications } from "../endpoints/notifications/pending_GET.schema";
import { postDismissNotification } from "../endpoints/notifications/dismiss_POST.schema";
import { useAuth } from "./useAuth";

export const NOTIFICATIONS_QUERY_KEY = ["notifications", "pending"] as const;

export function usePendingNotifications() {
  const { authState } = useAuth();
  const isAuthenticated = authState.type === "authenticated";

  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => getPendingNotifications(),
    enabled: isAuthenticated,
    refetchOnWindowFocus: true,
  });
}

export function useDismissNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: number) => postDismissNotification({ notificationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
}