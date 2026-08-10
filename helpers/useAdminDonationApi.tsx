import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { postAdminCharityOrganizationSave } from "../endpoints/admin/charity-organization/save_POST.schema";
import superjson from "superjson";
import type { Selectable } from "kysely";
import type { CharityOrganizations } from "./schema";

export type CharityOrganization = Selectable<CharityOrganizations>;

export const useAdminCharityOrganizations = () => {
  return useQuery<CharityOrganization[]>({
    queryKey: ["adminCharityOrganizations"],
    queryFn: async () => {
      const res = await fetch(`/_api/admin/charity-organizations`);
      if (!res.ok) {
        const errorObject = superjson.parse<{ error: string }>(await res.text());
        throw new Error(errorObject.error);
      }
      return superjson.parse<CharityOrganization[]>(await res.text());
    },
  });
};

export const useSaveCharityOrganization = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postAdminCharityOrganizationSave,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCharityOrganizations"] });
    },
  });
};

export const useDeleteCharityOrganization = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number }) => {
      const res = await fetch(`/_api/admin/charity-organization/delete`, {
        method: "POST",
        body: superjson.stringify(input),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const errorObject = superjson.parse<{ error: string }>(await res.text());
        throw new Error(errorObject.error);
      }
      return superjson.parse<{ success: boolean }>(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCharityOrganizations"] });
    },
  });
};