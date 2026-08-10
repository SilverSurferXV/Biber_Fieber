import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { postProductRatingSubmit } from "../endpoints/product-rating/submit_POST.schema";
import { getAdminProductRatings } from "../endpoints/admin/product-ratings_GET.schema";
import { MY_RATINGS_QUERY_KEY } from "./useMyRatings";

export const useSubmitProductRating = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postProductRatingSubmit,
    onSuccess: () => {
      // Invalidate both admin and potentially frontend product rating queries
      qc.invalidateQueries({ queryKey: ["admin", "productRatings"] });
      qc.invalidateQueries({ queryKey: MY_RATINGS_QUERY_KEY });
    },
  });
};

export const useAdminProductRatings = () => {
  return useQuery({
    queryKey: ["admin", "productRatings"],
    queryFn: () => getAdminProductRatings({}),
  });
};