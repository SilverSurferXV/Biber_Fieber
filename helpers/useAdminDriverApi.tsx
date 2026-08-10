import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminDrivers } from "../endpoints/admin/drivers_GET.schema";
import { postAdminDriverSave } from "../endpoints/admin/driver/save_POST.schema";
import { postAdminDriverDelete } from "../endpoints/admin/driver/delete_POST.schema";

export const useAdminDrivers = () => {
  return useQuery({
    queryKey: ["admin", "drivers"],
    queryFn: () => getAdminDrivers({}),
    staleTime: 2 * 60 * 1000,
  });
};

export const useSaveAdminDriver = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postAdminDriverSave,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "drivers"] });
    },
  });
};

export const useDeleteAdminDriver = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postAdminDriverDelete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "drivers"] });
    },
  });
};