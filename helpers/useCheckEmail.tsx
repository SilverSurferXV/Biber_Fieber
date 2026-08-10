import { useQuery } from "@tanstack/react-query";
import { getCheckEmail } from "../endpoints/auth/check-email_GET.schema";

export const useCheckEmail = (email: string) => {
  return useQuery({
    // Only run the query if there's a valid-looking email
    queryKey: ["check-email", email],
    queryFn: () => getCheckEmail({ email }),
    enabled: !!email && email.includes("@"),
    retry: false,
  });
};