import { useQuery } from "@tanstack/react-query";
import { getAdminLoginHistory, schema } from "../endpoints/admin/login-history_GET.schema";
import { z } from "zod";

type InputParams = z.infer<typeof schema>;

export const ADMIN_LOGIN_HISTORY_QUERY_KEY = (params: InputParams) => ["admin", "loginHistory", params] as const;

export const useAdminLoginHistoryQuery = (params: InputParams) => {
  return useQuery({
    queryKey: ADMIN_LOGIN_HISTORY_QUERY_KEY(params),
    queryFn: () => getAdminLoginHistory(params),
    placeholderData: (prev) => prev,
  });
};