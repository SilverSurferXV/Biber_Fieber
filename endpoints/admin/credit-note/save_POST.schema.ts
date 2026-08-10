import { z } from "zod";
import superjson from "superjson";
import { CreditNoteStatus } from '../../../helpers/schema';

export const schema = z.object({
  driverId: z.number(),
  gutschriftNumber: z.string(),
  blockStart: z.date(),
  blockEnd: z.date(),
  stopCompensation: z.number(),
  packagingCompensation: z.number(),
  totalStopEarnings: z.number(),
  totalPackagingEarnings: z.number(),
  totalAmount: z.number(),
  vatAmount: z.number().nullable(),
  detailData: z.object({
    driverName: z.string(),
    driverEmail: z.string(),
    invoiceCompanyName: z.string().nullable().optional(),
    invoiceStreet: z.string().nullable().optional(),
    invoiceHouseNumber: z.string().nullable().optional(),
    invoicePostcode: z.string().nullable().optional(),
    invoiceCity: z.string().nullable().optional(),
    invoiceTaxId: z.string().nullable().optional(),
    invoiceTaxNumber: z.string().nullable().optional(),
    vatEligible: z.boolean(),
    dailyEarnings: z.array(z.object({ date: z.string(), stopsCount: z.number(), earnings: z.number() })),
    packagingDays: z.array(z.object({ date: z.string() })),
  }).optional()
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  id: number;
  gutschriftNumber: string;
  status: CreditNoteStatus;
  expiresAt: Date;
};

export const postSaveCreditNote = async (
body: z.infer<typeof schema>,
init?: RequestInit)
: Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/credit-note/save`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{error: string;}>(await result.text());
    throw new Error(errorObject.error || "Failed to save credit note");
  }
  return superjson.parse<OutputType>(await result.text());
};