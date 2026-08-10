import { useQuery } from "@tanstack/react-query";
import { getDeliveryZonesList, OutputType } from "../endpoints/delivery-zones/list_GET.schema";

export const DELIVERY_ZONES_LIST_QUERY_KEY = ["deliveryZones", "list"] as const;

export const useDeliveryZonesList = () => {
  return useQuery<OutputType, Error>({
    queryKey: DELIVERY_ZONES_LIST_QUERY_KEY,
    queryFn: async () => {
      return await getDeliveryZonesList();
    },
    // The list of delivery zones rarely changes, so we can cache it for a bit.
    staleTime: 5 * 60 * 1000, 
  });
};