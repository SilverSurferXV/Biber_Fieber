import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getDriverOrders,
  OutputType as DriverOrdersType,
} from "../endpoints/driver/orders_GET.schema";
import { postDeliverOrder } from "../endpoints/driver/order/deliver_POST.schema";

export const DRIVER_ORDERS_QUERY_KEY = ["driver", "orders"];

export function useDriverOrders() {
  return useQuery<DriverOrdersType, Error>({
    queryKey: DRIVER_ORDERS_QUERY_KEY,
    queryFn: () => getDriverOrders(),
    staleTime: 30 * 1000,
  });
}

export function useMarkOrderDelivered() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: number) => postDeliverOrder({ orderId }),
    onMutate: async (orderId: number) => {
      await queryClient.cancelQueries({ queryKey: DRIVER_ORDERS_QUERY_KEY });

      const previousOrders = queryClient.getQueryData<DriverOrdersType>(
        DRIVER_ORDERS_QUERY_KEY
      );

      if (previousOrders) {
        const updatedOrders = previousOrders.orders.map((order) =>
          order.id === orderId ? { ...order, status: "delivered" as const } : order
        );
        queryClient.setQueryData<DriverOrdersType>(DRIVER_ORDERS_QUERY_KEY, {
          ...previousOrders,
          orders: updatedOrders,
        });
      }

      return { previousOrders };
    },
    onError: (err, orderId, context) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to mark order as delivered"
      );
      if (context?.previousOrders) {
        queryClient.setQueryData(
          DRIVER_ORDERS_QUERY_KEY,
          context.previousOrders
        );
      }
    },
    onSuccess: () => {
      toast.success("Order marked as delivered!");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: DRIVER_ORDERS_QUERY_KEY });
    },
  });
}