import { useMutation } from "@tanstack/react-query";
import { postReconcileTopups, schema } from "../endpoints/admin/stripe/reconcile-topups_POST.schema";
import { z } from "zod";

export const useReconcileTopupsMutation = () => {
  return useMutation({
    mutationFn: async (input: z.infer<typeof schema>) => {
      return await postReconcileTopups(input);
    },
  });
};