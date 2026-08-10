import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminAdmins } from "../endpoints/admin/admins_GET.schema";
import { postAdminAdminRole, schema as roleSchema } from "../endpoints/admin/admin/role_POST.schema";
import { z } from "zod";

export const ADMIN_ADMINS_QUERY_KEY = ["admin", "admins"] as const;

export const useAdminAdminsQuery = () => {
  return useQuery({
    queryKey: ADMIN_ADMINS_QUERY_KEY,
    queryFn: () => getAdminAdmins({}),
  });
};

export const useAdminAdminRoleMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: z.infer<typeof roleSchema>) => postAdminAdminRole(data),
    onSuccess: () => {
      // Invalidate the admins list query to refresh the UI upon role change
      queryClient.invalidateQueries({ queryKey: ADMIN_ADMINS_QUERY_KEY });
    },
  });
};