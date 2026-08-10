import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminDriverEarnings } from "../endpoints/admin/driver/earnings_GET.schema";
import { postAdminDriverSave } from "../endpoints/admin/driver/save_POST.schema";

export const ADMIN_DRIVER_EARNINGS_QUERY_KEY = ["admin", "driver-earnings"];

export const useAdminDriverEarnings = (driverId?: number) => {
  return useQuery({
    queryKey: [...ADMIN_DRIVER_EARNINGS_QUERY_KEY, driverId],
    queryFn: () => getAdminDriverEarnings({ driverId: driverId! }),
    enabled: typeof driverId === "number",
    staleTime: 2 * 60 * 1000,
  });
};

export const useUpdateDriverCompensation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postAdminDriverSave,
    onSuccess: (_, variables) => {
      // Invalidate the overall drivers list to update cache
      qc.invalidateQueries({ queryKey: ["admin", "drivers"] });
      // Invalidate this driver's specific earnings if the ID was provided
      if (variables.id) {
        qc.invalidateQueries({ queryKey: [...ADMIN_DRIVER_EARNINGS_QUERY_KEY, variables.id] });
      }
    },
  });
};