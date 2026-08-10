import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Users } from "../../helpers/schema";

export const schema = z.object({});

export type OutputType = Pick<
  Selectable<Users>,
  | "id"
  | "firstName"
  | "lastName"
  | "email"
  | "mobileNumber"
  | "active"
  | "createdAt"
  | "billingCompanyName"
  | "billingStreet"
  | "billingCity"
  | "billingPostcode"
  | "billingCountry"
  | "billingTaxNumber"
  | "packagingCompensation"
  | "stopCompensation"
  | "invoiceCompanyName"
  | "invoiceStreet"
  | "invoiceHouseNumber"
  | "invoicePostcode"
  | "invoiceCity"
  | "invoiceTaxId"
  | "invoiceTaxNumber"
  | "vatEligible"
  | "iban"
>[];

export const getAdminDrivers = async (
  input: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/drivers`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};