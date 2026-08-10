import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getZoneDriverAssignments } from "../endpoints/admin/zone-driver-assignments_GET.schema";
import {
  postSaveZoneDriverAssignment,
  InputType as SaveAssignmentInput,
} from "../endpoints/admin/zone-driver-assignment/save_POST.schema";

export const ADMIN_ZONE_DRIVER_ASSIGNMENTS_QUERY_KEY = [
  "admin",
  "zone-driver-assignments",
] as const;

/**
 * Hook to fetch zone driver assignments.
 * 
 * @param dateKeys - A comma-separated list of date keys (e.g. "2024-05-10,2024-05-11").
 */
export function useAdminZoneDriverAssignments(dateKeys?: string) {
  return useQuery({
    queryKey: [...ADMIN_ZONE_DRIVER_ASSIGNMENTS_QUERY_KEY, dateKeys],
    queryFn: () => getZoneDriverAssignments(dateKeys),
    enabled: !!dateKeys,
  });
}

/**
 * Mutation hook to save/upsert a zone driver assignment.
 * Automatically invalidates the zone-driver-assignments query upon success.
 */
export function useSaveAdminZoneDriverAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: SaveAssignmentInput) =>
      postSaveZoneDriverAssignment(variables),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ADMIN_ZONE_DRIVER_ASSIGNMENTS_QUERY_KEY,
      });
    },
  });
}