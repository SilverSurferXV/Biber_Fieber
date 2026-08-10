import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postMicrosoftDeleteEmail } from "../endpoints/admin/microsoft/delete-email_POST.schema";
import { postMicrosoftMarkReplied } from "../endpoints/admin/microsoft/mark-replied_POST.schema";
import { MICROSOFT_KEYS } from "./useMicrosoftEmail";

export const useMicrosoftDeleteEmailMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => {
      return postMicrosoftDeleteEmail({ messageId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MICROSOFT_KEYS.emails() });
      queryClient.invalidateQueries({ queryKey: MICROSOFT_KEYS.unreadCount() });
    }
  });
};

export const useMicrosoftMarkRepliedMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => {
      return postMicrosoftMarkReplied({ messageId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MICROSOFT_KEYS.emails() });
    }
  });
};