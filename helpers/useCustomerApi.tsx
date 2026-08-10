import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCustomerProfile } from "../endpoints/customer/profile_GET.schema";
import { postCustomerProfileUpdate } from "../endpoints/customer/profile/update_POST.schema";
import { getCustomerOrders } from "../endpoints/orders/list_GET.schema";
import { postCheckout } from "../endpoints/cart/checkout_POST.schema";
import { postWalletTopup } from "../endpoints/wallet/topup_POST.schema";
import { getSonderbereichFiles } from "../endpoints/sonderbereich/list_GET.schema";
import { getCustomerInvoice } from "../endpoints/customer/invoice_GET.schema";
import { postCustomerDelete } from "../endpoints/customer/delete_POST.schema";
import { AUTH_QUERY_KEY } from "./useAuth";

export const useProfile = () => {
  return useQuery({
    queryKey: ["customer", "profile"],
    queryFn: () => getCustomerProfile({}),
    staleTime: 60 * 1000,
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postCustomerProfileUpdate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", "profile"] });
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
};

export const useOrders = () => {
  return useQuery({
    queryKey: ["customer", "orders"],
    queryFn: () => getCustomerOrders({}),
    staleTime: 60 * 1000,
  });
};

export const useCheckout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postCheckout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "profile"] });
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
};

export const useWalletTopup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postWalletTopup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", "profile"] });
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
};

export const useSonderbereichFiles = () => {
  return useQuery({
    queryKey: ["customer", "sonderbereich"],
    queryFn: () => getSonderbereichFiles({}),
    staleTime: 2 * 60 * 1000,
  });
};

export const useInvoice = (month: string) => {
  return useQuery({
    queryKey: ["customer", "invoice", month],
    queryFn: () => getCustomerInvoice({ month }),
    enabled: /^\d{4}-\d{2}$/.test(month),
    staleTime: 5 * 60 * 1000,
  });
};

export const useDeleteAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postCustomerDelete,
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      queryClient.resetQueries();
    },
  });
};