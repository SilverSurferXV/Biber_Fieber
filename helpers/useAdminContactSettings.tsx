import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminContactSettings } from "../endpoints/admin/contact-settings_GET.schema";
import { postAdminContactSettingsSave } from "../endpoints/admin/contact-settings/save_POST.schema";

export const ADMIN_CONTACT_SETTINGS_QUERY_KEY = ["admin", "contact-settings"];

export function useAdminContactSettings() {
  return useQuery({
    queryKey: ADMIN_CONTACT_SETTINGS_QUERY_KEY,
    queryFn: () => getAdminContactSettings(),
  });
}

export function useSaveAdminContactSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postAdminContactSettingsSave,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_CONTACT_SETTINGS_QUERY_KEY });
    },
  });
}