import { useMutation } from "@tanstack/react-query";
import { postContactSend, InputType } from "../endpoints/contact/send_POST.schema";

export const useContactForm = () => {
  return useMutation({
    mutationFn: (data: InputType) => postContactSend(data),
  });
};