import { z } from "zod";
import superjson from "superjson";
import { CreditNoteStatus } from "../../helpers/schema";

export const schema = z.object({});

export type AdminCreditNoteItem = {
  id: number;
  driverId: number;
  driverName: string;
  gutschriftNumber: string;
  blockStart: Date;
  blockEnd: Date;
 totalAmount: number;
 totalCarDeduction: number;
 vatAmount: number | null;
 status: CreditNoteStatus;
  approvedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
};

export type OutputType = AdminCreditNoteItem[];

export const getAdminCreditNotes = async (
  driverId?: number,
  init?: RequestInit
): Promise<OutputType> => {
  const url = new URL(`/_api/admin/credit-notes`, window.location.origin);
  if (driverId) {
    url.searchParams.set("driverId", driverId.toString());
  }

  const result = await fetch(url.toString(), {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error || "Failed to fetch credit notes");
  }

  return superjson.parse<OutputType>(await result.text());
};