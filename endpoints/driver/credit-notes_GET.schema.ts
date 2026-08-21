import { z } from "zod";
import superjson from "superjson";
import { CreditNoteStatus } from "../../helpers/schema";

export const schema = z.object({});

export type DetailData = {
  driverName: string;
  driverEmail: string;
  invoiceCompanyName?: string | null;
  invoiceStreet?: string | null;
  invoiceHouseNumber?: string | null;
  invoicePostcode?: string | null;
  invoiceCity?: string | null;
  invoiceTaxId?: string | null;
  invoiceTaxNumber?: string | null;
  vatEligible: boolean;
 dailyEarnings: { date: string; stopsCount: number; companyCarStops?: number; grossEarnings?: number; carDeduction?: number; earnings: number }[];
 packagingDays: { date: string }[];
 totalCarDeduction?: number;
};

export type DriverCreditNoteItem = {
  id: number;
  gutschriftNumber: string;
  blockStart: Date;
  blockEnd: Date;
  stopCompensation: number;
  packagingCompensation: number;
 totalStopEarnings: number;
 totalPackagingEarnings: number;
 totalAmount: number;
 totalCarDeduction: number;
 vatAmount: number | null;
  status: CreditNoteStatus;
  approvedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  detailData: DetailData | null;
};

export type OutputType = DriverCreditNoteItem[];

export const getDriverCreditNotes = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/driver/credit-notes`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error || "Failed to fetch driver credit notes");
  }

  return superjson.parse<OutputType>(await result.text());
};