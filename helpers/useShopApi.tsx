import { useQuery } from "@tanstack/react-query";
import { getSettings } from "../endpoints/settings_GET.schema";
import { getCategoriesList } from "../endpoints/categories/list_GET.schema";
import { getProductsList } from "../endpoints/products/list_GET.schema";
import { getDeliveryZoneCheck } from "../endpoints/delivery-zones/check_GET.schema";

export const useSettings = () => {
  return useQuery({
    queryKey: ["shop", "settings"],
    queryFn: () => getSettings({}),
    staleTime: 5 * 60 * 1000,
  });
};

export const useCategories = () => {
  return useQuery({
    queryKey: ["shop", "categories"],
    queryFn: () => getCategoriesList({}),
    staleTime: 5 * 60 * 1000,
  });
};

export const useProducts = (categoryId?: number) => {
  return useQuery({
    queryKey: ["shop", "products", categoryId],
    queryFn: () => getProductsList({ categoryId }),
    staleTime: 2 * 60 * 1000,
  });
};

export const useDeliveryZoneCheck = (postcode: string) => {
  return useQuery({
    queryKey: ["shop", "deliveryZone", postcode],
    queryFn: () => getDeliveryZoneCheck({ postcode, checkThreshold: false }),
    enabled: postcode.length > 0,
    staleTime: 10 * 60 * 1000,
  });
};