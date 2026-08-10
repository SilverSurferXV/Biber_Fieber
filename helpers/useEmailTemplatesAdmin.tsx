import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getEmailTemplates } from "../endpoints/admin/email-templates_GET.schema";
import { postSaveEmailTemplate, InputType as SaveEmailTemplateInput } from "../endpoints/admin/email-template/save_POST.schema";

export const EMAIL_TEMPLATES_QUERY_KEY = ["admin", "email-templates"] as const;

export function useEmailTemplates() {
  return useQuery({
    queryKey: EMAIL_TEMPLATES_QUERY_KEY,
    queryFn: () => getEmailTemplates(),
  });
}

export function useSaveEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SaveEmailTemplateInput) => postSaveEmailTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMAIL_TEMPLATES_QUERY_KEY });
      toast.success("Vorlage gespeichert");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Ein Fehler ist beim Speichern aufgetreten"
      );
    },
  });
}