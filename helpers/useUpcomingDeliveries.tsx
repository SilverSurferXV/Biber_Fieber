import { useQuery } from "@tanstack/react-query";
import {
  getUpcomingDeliveries,
  OutputType,
} from "../endpoints/driver/upcoming-deliveries_GET.schema";

export const UPCOMING_DELIVERIES_QUERY_KEY = ["driver", "upcoming-deliveries"];

export function useUpcomingDeliveries() {
  return useQuery<OutputType, Error>({
    queryKey: UPCOMING_DELIVERIES_QUERY_KEY,
    queryFn: () => getUpcomingDeliveries(),
    staleTime: 60 * 1000,
  });
}