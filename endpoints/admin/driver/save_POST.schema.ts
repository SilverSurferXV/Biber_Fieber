import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  id: z.number().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  mobileNumber: z.string().optional(),
  billingCompanyName: z.string().optional(),
  billingStreet: z.string().optional(),
  billingCity: z.string().optional(),
  billingPostcode: z.string().optional(),
  billingCountry: z.string().optional(),
  billingTaxNumber: z.string().optional(),
  packagingCompensation: z.number().min(0).optional(),
  stopCompensation: z.number().min(0).optional(),
  invoiceCompanyName: z.string().optional(),
  invoiceStreet: z.string().optional(),
  invoiceHouseNumber: z.string().optional(),
  invoicePostcode: z.string().optional(),
  invoiceCity: z.string().optional(),
  invoiceTaxId: z.string().optional(),
  invoiceTaxNumber: z.string().optional(),
  vatEligible: z.boolean().optional(),
  iban: z.string().optional(),
});

export type OutputType = {
  success: boolean;
  userId: number;
};

export const postAdminDriverSave = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/driver/save`, {
    method: "POST",
    body: superjson.stringify(input),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error || "Failed to save driver");
  }

  return superjson.parse<OutputType>(await result.text());
};