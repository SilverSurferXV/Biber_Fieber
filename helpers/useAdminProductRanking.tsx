import { useQuery } from "@tanstack/react-query";
import { getAdminProductRanking } from "../endpoints/admin/product-ranking_GET.schema";

interface UseAdminProductRankingParams {
  startDate?: string;
  endDate?: string;
}

export const useAdminProductRanking = (params: UseAdminProductRankingParams = {}) => {
  const { startDate, endDate } = params;
  return useQuery({
    queryKey: ["admin", "productRanking", startDate ?? null, endDate ?? null],
    queryFn: () => getAdminProductRanking({ startDate, endDate }),
  });
};