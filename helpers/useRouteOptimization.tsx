import { useState, useCallback } from "react";
import { toast } from "sonner";
import { postOptimizeRoute } from "../endpoints/driver/optimize-route_POST.schema";

export const LAGER_ALLING_ADDRESS = "Am Hartholz 3, 82239 Alling";

export interface Stop {
  address: string;
}

export const useRouteOptimization = () => {
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optimizedOrder, setOptimizedOrder] = useState<number[] | null>(null);

  const optimizeRoute = useCallback(
    async (
      stops: Stop[],
      startAddress: string,
      endAddress: string
    ): Promise<number[] | null> => {
      setIsOptimizing(true);
      setOptimizedOrder(null);

      try {
        if (stops.length === 0) {
          setOptimizedOrder([]);
          return [];
        }

        // Trivial case: no need to invoke OSRM for 1 intermediate stop
        if (stops.length === 1) {
          setOptimizedOrder([0]);
          return [0];
        }

        const { optimizedOrder: newOptimizedOrder } = await postOptimizeRoute({
          stops,
          startAddress,
          endAddress,
        });

        setOptimizedOrder(newOptimizedOrder);
        toast.success("Route successfully optimized");

        return newOptimizedOrder;
      } catch (err) {
        console.error("Error optimizing route:", err);
        toast.error(
          err instanceof Error
            ? err.message
            : "An error occurred during route optimization"
        );
        return null;
      } finally {
        setIsOptimizing(false);
      }
    },
    []
  );

  return { optimizeRoute, isOptimizing, optimizedOrder };
};