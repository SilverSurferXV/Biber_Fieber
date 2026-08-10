import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminTranslation, EnabledLanguagesType } from "../endpoints/admin/translation_GET.schema";
import { postAdminTranslationSave } from "../endpoints/admin/translation/save_POST.schema";

export const ADMIN_TRANSLATION_QUERY_KEY = ["admin", "translation"];

export function useAdminTranslation() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ADMIN_TRANSLATION_QUERY_KEY,
    queryFn: () => getAdminTranslation(),
  });

  const saveMutation = useMutation({
    mutationFn: async (enabledLanguages: EnabledLanguagesType) => {
      return postAdminTranslationSave({ enabledLanguages });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_TRANSLATION_QUERY_KEY });
    },
  });

  return {
    enabledLanguages: data?.enabledLanguages,
    isLoading,
    error,
    saveLanguages: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}