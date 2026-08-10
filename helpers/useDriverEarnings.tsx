import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import {
  getDriverEarnings,
  OutputType as DriverEarningsType,
} from "../endpoints/driver/earnings_GET.schema";

export const DRIVER_EARNINGS_QUERY_KEY = ["driver", "earnings"];

/**
 * Hook to fetch the driver's earnings overview including daily breakdown
 * and cumulative totals.
 */
export function useDriverEarnings(options?: Omit<UseQueryOptions<DriverEarningsType, Error>, "queryKey" | "queryFn">) {
  return useQuery<DriverEarningsType, Error>({
    queryKey: DRIVER_EARNINGS_QUERY_KEY,
    queryFn: () => getDriverEarnings(),
    // Standard driver dashboard refresh
    refetchInterval: 5 * 60 * 1000,
    ...options,
  });
}