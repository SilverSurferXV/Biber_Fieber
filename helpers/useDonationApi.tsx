import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCharityOrganizations } from "../endpoints/charity-organizations/list_GET.schema";
import { postCustomerCharityOrganizationUpdate } from "../endpoints/customer/charity-organization/update_POST.schema";
import { AUTH_QUERY_KEY } from "./useAuth";

export const useCharityOrganizations = () => {
  return useQuery({
    queryKey: ["charity-organizations"],
    queryFn: () => getCharityOrganizations({}),
    staleTime: 5 * 60 * 1000,
  });
};

export const useUpdateCharityOrganization = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postCustomerCharityOrganizationUpdate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", "profile"] });
      queryClient.invalidateQueries({ queryKey: ["charity-organizations"] });
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
};