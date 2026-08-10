import { useQuery } from "@tanstack/react-query";
import { getFfbNews } from "../endpoints/news/ffb_GET.schema";

export const useFfbNews = () => {
  return useQuery({
    queryKey: ["news", "ffb"],
    queryFn: async () => {
      const result = await getFfbNews();
      if ("error" in result) {
        throw new Error(result.error);
      }
      return result.items;
    },
    // The backend caches for 30 minutes, so we can also cache it securely on the frontend for 30 minutes
    staleTime: 30 * 60 * 1000, 
  });
};