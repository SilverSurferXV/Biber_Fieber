import { z } from "zod";
 
 export const getAdminBusinessCustomersBackup = async (options?: { userIds?: number[] }, init?: RequestInit): Promise<Blob> => {
  const queryParams = new URLSearchParams();
  if (options?.userIds && options.userIds.length > 0) {
    queryParams.set("userIds", options.userIds.join(","));
  }
  const queryString = queryParams.toString();
  const result = await fetch(`/_api/admin/business-customers/backup${queryString ? `?${queryString}` : ""}`, {
     method: "GET",
     ...init,
     headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  
   if (!result.ok) {
     const errorText = await result.text();
     let errorMessage = errorText;
    try {
      errorMessage = JSON.parse(errorText).error;
    } catch {
      // ignore parse error
    }
     throw new Error(errorMessage || result.statusText);
   }
   
  return await result.blob();
};