import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMicrosoftStatus } from "../endpoints/admin/microsoft/status_GET.schema";
import { postMicrosoftDisconnect } from "../endpoints/admin/microsoft/disconnect_POST.schema";
import { getMicrosoftEmails } from "../endpoints/admin/microsoft/emails_GET.schema";
import { postMicrosoftSendEmail } from "../endpoints/admin/microsoft/send-email_POST.schema";

export const MICROSOFT_KEYS = {
  all: ["admin", "microsoft"] as const,
  status: () => [...MICROSOFT_KEYS.all, "status"] as const,
  emails: () => [...MICROSOFT_KEYS.all, "emails"] as const,
  unreadCount: () => [...MICROSOFT_KEYS.all, "unread-count"] as const,
};

export const useMicrosoftStatus = () => {
  return useQuery({
    queryKey: MICROSOFT_KEYS.status(),
    queryFn: () => getMicrosoftStatus(),
    staleTime: 60 * 1000,
  });
};

export const useMicrosoftDisconnect = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postMicrosoftDisconnect,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MICROSOFT_KEYS.status() });
      qc.removeQueries({ queryKey: MICROSOFT_KEYS.emails() });
    },
  });
};

export const useMicrosoftEmails = () => {
  const { data: statusData } = useMicrosoftStatus();

  return useQuery({
    queryKey: MICROSOFT_KEYS.emails(),
    queryFn: () => getMicrosoftEmails(),
    enabled: !!statusData?.connected,
    staleTime: 30 * 1000, // Emails change frequently
    retry: false, // Don't retry since 401s require user action
  });
};

export const useSendMicrosoftEmail = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postMicrosoftSendEmail,
    onSuccess: () => {
      // Small delay since Graph indexing might not be instantaneous in the sent folder
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: MICROSOFT_KEYS.emails() });
      }, 1000);
    },
  });
};