import { useQuery } from "@tanstack/react-query";
import { getProductRatingMyRatings } from "../endpoints/product-rating/my-ratings_GET.schema";
import { useAuth } from "./useAuth";

export const MY_RATINGS_QUERY_KEY = ["my-ratings"] as const;

export function useMyRatings() {
  const { authState } = useAuth();
  const isAuthenticated = authState.type === "authenticated";

  return useQuery({
    queryKey: MY_RATINGS_QUERY_KEY,
    queryFn: async () => {
      const result = await getProductRatingMyRatings();
      return result.ratings;
    },
    enabled: isAuthenticated,
  });
}