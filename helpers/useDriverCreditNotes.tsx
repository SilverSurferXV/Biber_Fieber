import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDriverCreditNotes } from "../endpoints/driver/credit-notes_GET.schema";
import { postApproveCreditNote } from "../endpoints/driver/credit-note/approve_POST.schema";
import { getAdminCreditNotes } from "../endpoints/admin/credit-notes_GET.schema";
import { postSaveCreditNote } from "../endpoints/admin/credit-note/save_POST.schema";
import { toast } from "sonner";

export const DRIVER_CREDIT_NOTES_KEY = ["driver", "credit-notes"];
export const ADMIN_CREDIT_NOTES_KEY = ["admin", "credit-notes"];

export function useDriverCreditNotes() {
  return useQuery({
    queryKey: DRIVER_CREDIT_NOTES_KEY,
    queryFn: () => getDriverCreditNotes(),
  });
}

export function useApproveCreditNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (creditNoteId: number) =>
      postApproveCreditNote({ creditNoteId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DRIVER_CREDIT_NOTES_KEY });
      toast.success("Gutschrift erfolgreich bestätigt.");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Ein Fehler ist aufgetreten."
      );
    },
  });
}

export function useAdminCreditNotes(driverId?: number) {
  return useQuery({
    queryKey: [...ADMIN_CREDIT_NOTES_KEY, driverId],
    queryFn: () => getAdminCreditNotes(driverId),
  });
}

export function useSaveCreditNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postSaveCreditNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_CREDIT_NOTES_KEY });
      toast.success("Gutschrift erfolgreich gespeichert.");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Ein Fehler ist aufgetreten."
      );
    },
  });
}