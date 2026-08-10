import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminSuppliers } from "../endpoints/admin/suppliers_GET.schema";
import { postAdminSupplierSave } from "../endpoints/admin/supplier/save_POST.schema";
import { postAdminSupplierDelete } from "../endpoints/admin/supplier/delete_POST.schema";

export const useAdminSuppliers = () => {
  return useQuery({
    queryKey: ["admin", "suppliers"],
    queryFn: () => getAdminSuppliers({}),
    staleTime: 2 * 60 * 1000,
  });
};

export const useSaveAdminSupplier = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postAdminSupplierSave,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "suppliers"] });
    },
  });
};

export const useDeleteAdminSupplier = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postAdminSupplierDelete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "suppliers"] });
      // Invalidate products because supplier name on products gets nulled out
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });
};