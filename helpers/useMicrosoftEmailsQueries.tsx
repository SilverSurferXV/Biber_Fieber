import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMicrosoftUnreadCount } from "../endpoints/admin/microsoft/unread-count_GET.schema";
import { postMicrosoftMarkRead } from "../endpoints/admin/microsoft/mark-read_POST.schema";
import { MICROSOFT_KEYS } from "./useMicrosoftEmail";

export const useMicrosoftUnreadCount = () => {
  return useQuery({
    queryKey: MICROSOFT_KEYS.unreadCount(),
    queryFn: () => getMicrosoftUnreadCount(),
  });
};

export const useMicrosoftMarkRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      return postMicrosoftMarkRead({ messageId });
    },
    onSuccess: () => {
      // Invalidate both unread count and emails list queries to stay fully synchronized
      queryClient.invalidateQueries({ queryKey: MICROSOFT_KEYS.unreadCount() });
      queryClient.invalidateQueries({ queryKey: MICROSOFT_KEYS.emails() });
    },
  });
};