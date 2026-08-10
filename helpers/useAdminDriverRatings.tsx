import { useQuery } from "@tanstack/react-query";
import { getAdminDriverRatings } from "../endpoints/admin/driver-ratings_GET.schema";

export const ADMIN_DRIVER_RATINGS_QUERY_KEY = ["admin", "driver-ratings"] as const;

export function useAdminDriverRatings() {
  return useQuery({
    queryKey: ADMIN_DRIVER_RATINGS_QUERY_KEY,
    queryFn: () => getAdminDriverRatings(),
  });
}