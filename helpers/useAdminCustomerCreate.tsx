import { useMutation } from "@tanstack/react-query";
import { postAdminCustomerCreate, schema } from "../endpoints/admin/customer/create_POST.schema";
import { z } from "zod";

type AdminCustomerCreateInput = z.infer<typeof schema>;

export const useAdminCustomerCreate = () => {
  return useMutation({
    mutationFn: (input: AdminCustomerCreateInput) => postAdminCustomerCreate(input),
  });
};