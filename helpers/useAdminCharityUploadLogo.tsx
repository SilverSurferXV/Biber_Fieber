import { useMutation } from "@tanstack/react-query";
import { postUploadCharityLogo } from "../endpoints/admin/charity-organization/upload-logo_POST.schema";

export const useAdminCharityUploadLogo = () => {
  return useMutation({
    mutationFn: postUploadCharityLogo,
  });
};