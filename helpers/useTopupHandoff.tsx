import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { postHandoffCreate } from "../endpoints/wallet/handoff/create_POST.schema";
import { getHandoffInfo } from "../endpoints/wallet/handoff/info_GET.schema";
import { postHandoffCreateIntent } from "../endpoints/wallet/handoff/create-intent_POST.schema";
import { postHandoffConfirm } from "../endpoints/wallet/handoff/confirm_POST.schema";
import { AUTH_QUERY_KEY } from "./useAuth";

export const useCreateTopupHandoff = () => {
  return useMutation({
    mutationFn: postHandoffCreate,
  });
};

export const useTopupHandoffInfo = (
  token: string | null | undefined,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: ["topup-handoff", token],
    queryFn: async () => {
      if (!token) throw new Error("Missing token");
      return await getHandoffInfo({ token });
    },
    enabled: !!token && (options?.enabled ?? true),
    retry: false,
  });
};

export const useCreateHandoffIntent = () => {
  return useMutation({
    mutationFn: postHandoffCreateIntent,
  });
};

export const useConfirmHandoffTopup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postHandoffConfirm,
    onSuccess: () => {
      // Refresh user session data to show updated points balance instantly
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
};