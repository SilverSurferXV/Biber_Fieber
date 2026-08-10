import { useQuery } from "@tanstack/react-query";
import { getMailjetStatus } from "../endpoints/admin/mailjet/status_GET.schema";

export function useMailjetStatus() {
  return useQuery({
    queryKey: ["admin", "mailjet", "status"],
    queryFn: () => getMailjetStatus(),
  });
}