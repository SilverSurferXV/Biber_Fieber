import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminEmailSignatures } from "../endpoints/admin/email-signatures_GET.schema";
import { postAdminEmailSignatureSave } from "../endpoints/admin/email-signature/save_POST.schema";
import { postAdminEmailSignatureDelete } from "../endpoints/admin/email-signature/delete_POST.schema";

export const useAdminEmailSignatures = () => {
  return useQuery({
    queryKey: ["admin", "emailSignatures"],
    queryFn: () => getAdminEmailSignatures({}),
    staleTime: 2 * 60 * 1000,
  });
};

export const useSaveAdminEmailSignature = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postAdminEmailSignatureSave,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "emailSignatures"] });
    },
  });
};

export const useDeleteAdminEmailSignature = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postAdminEmailSignatureDelete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "emailSignatures"] });
    },
  });
};