import { useMutation } from "@tanstack/react-query";
import { postAdminBonusTiersSave, InputType } from "../endpoints/admin/bonus-tiers/save_POST.schema";

export function useSaveBonusTiersMutation() {
  return useMutation({
    mutationFn: (data: InputType) => postAdminBonusTiersSave(data),
  });
}