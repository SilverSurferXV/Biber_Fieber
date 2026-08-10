import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { getAdminProducts } from "../endpoints/admin/products_GET.schema";
import { postAdminProductSave } from "../endpoints/admin/product/save_POST.schema";
import { postAdminProductDelete } from "../endpoints/admin/product/delete_POST.schema";

import { getAdminCategories } from "../endpoints/admin/categories_GET.schema";
import { postAdminCategorySave } from "../endpoints/admin/category/save_POST.schema";

import { getAdminOrders } from "../endpoints/admin/orders_GET.schema";
import { postDeleteOrder } from "../endpoints/admin/order/delete_POST.schema";

import { getAdminCustomers } from "../endpoints/admin/customers_GET.schema";
import { postAdminCustomerUpdate } from "../endpoints/admin/customer/update_POST.schema";
import { postAdminCustomerDelete } from "../endpoints/admin/customer/delete_POST.schema";
import { postAdminPointAdjustment } from "../endpoints/admin/point-adjustment_POST.schema";

import { getAdminDeliveryZones } from "../endpoints/admin/delivery-zones_GET.schema";
import { postAdminDeliveryZoneSave } from "../endpoints/admin/delivery-zone/save_POST.schema";
import { postAdminDeliveryZoneDelete } from "../endpoints/admin/delivery-zone/delete_POST.schema";

import { postAdminSettingsSave } from "../endpoints/admin/settings/save_POST.schema";
import { getAdminReviews } from "../endpoints/admin/reviews_GET.schema";
import { postAdminPushNotificationSend } from "../endpoints/admin/push-notification/send_POST.schema";

import { getAdminSonderbereichFiles } from "../endpoints/admin/sonderbereich_GET.schema";
import { postAdminSonderbereichSave } from "../endpoints/admin/sonderbereich/save_POST.schema";
import { postAdminSonderbereichDelete } from "../endpoints/admin/sonderbereich/delete_POST.schema";

import { getAdminStatistics } from "../endpoints/admin/statistics_GET.schema";

// Products
export const useAdminProducts = (opts?: { page?: number; limit?: number }) => useQuery({ queryKey: ["admin", "products", opts?.page, opts?.limit], queryFn: () => getAdminProducts({ page: opts?.page, limit: opts?.limit }), staleTime: 60 * 1000 });
export const useSaveAdminProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postAdminProductSave,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["admin", "productRanking"] });
    },
  });
};
export const useDeleteAdminProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postAdminProductDelete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["admin", "productRanking"] });
    },
  });
};

// Categories
export const useAdminCategories = () => useQuery({ queryKey: ["admin", "categories"], queryFn: () => getAdminCategories({}), staleTime: 2 * 60 * 1000 });
export const useSaveAdminCategory = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: postAdminCategorySave, onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "categories"] }) });
};

// Orders
export const useAdminOrders = (opts?: { date?: string; page?: number; limit?: number }) => useQuery({ queryKey: ["admin", "orders", opts?.date, opts?.page, opts?.limit], queryFn: () => getAdminOrders({ date: opts?.date, page: opts?.page, limit: opts?.limit }), staleTime: 30 * 1000 });
export const useDeleteAdminOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postDeleteOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      qc.invalidateQueries({ queryKey: ["admin", "customers"] });
    },
  });
};

// Customers
export const useAdminCustomers = (opts?: { page?: number; limit?: number; search?: string; businessOnly?: boolean; excludeBusiness?: boolean }) => useQuery({ queryKey: ["admin", "customers", opts?.page, opts?.limit, opts?.search, opts?.businessOnly, opts?.excludeBusiness], queryFn: () => getAdminCustomers({ page: opts?.page, limit: opts?.limit, search: opts?.search, businessOnly: opts?.businessOnly, excludeBusiness: opts?.excludeBusiness }), staleTime: 60 * 1000 });
export const useUpdateAdminCustomer = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: postAdminCustomerUpdate, onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "customers"] }) });
};
export const useDeleteAdminCustomer = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: postAdminCustomerDelete, onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "customers"] }) });
};
export const useAdjustCustomerPoints = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: postAdminPointAdjustment, onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "customers"] }); qc.invalidateQueries({ queryKey: ["adminCustomerTransactions"] }); } });
};

// Zones
export const useAdminDeliveryZones = () => useQuery({ queryKey: ["admin", "deliveryZones"], queryFn: () => getAdminDeliveryZones({}), staleTime: 2 * 60 * 1000 });
export const useSaveAdminDeliveryZone = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: postAdminDeliveryZoneSave, onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "deliveryZones"] }) });
};
export const useDeleteAdminDeliveryZone = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: postAdminDeliveryZoneDelete, onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "deliveryZones"] }) });
};

// General
export const useSaveAdminSettings = () => useMutation({ mutationFn: postAdminSettingsSave });
export const useAdminReviews = () => useQuery({ queryKey: ["admin", "reviews"], queryFn: () => getAdminReviews({}), staleTime: 2 * 60 * 1000 });
export const useSendPushNotification = () => useMutation({ mutationFn: postAdminPushNotificationSend });

// Sonderbereich
export const useAdminSonderbereichFiles = () => useQuery({ queryKey: ["admin", "sonderbereich"], queryFn: () => getAdminSonderbereichFiles({}), staleTime: 2 * 60 * 1000 });
export const useSaveAdminSonderbereichFile = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: postAdminSonderbereichSave, onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "sonderbereich"] }) });
};
export const useDeleteAdminSonderbereichFile = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: postAdminSonderbereichDelete, onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "sonderbereich"] }) });
};

// Statistics
export const useAdminStatistics = () => useQuery({ queryKey: ["admin", "statistics"], queryFn: () => getAdminStatistics({}), staleTime: 60 * 1000 });