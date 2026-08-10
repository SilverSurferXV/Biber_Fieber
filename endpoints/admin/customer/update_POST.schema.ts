import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  userId: z.number(),
  salutation: z.string().nullable().optional(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().email(),
  streetAddress: z.string().nullable(),
  city: z.string().nullable(),
  postcode: z.string().nullable(),
  mobileNumber: z.string().nullable(),
  notificationPreference: z.enum(["both", "email", "sms"]).nullable(),
  languagePreference: z.enum(["de", "en", "es", "it", "tr"]).nullable(),
  pointsBalance: z.number().nullable(),
  dateOfBirth: z.string().nullable().optional(),
  newPassword: z.string().min(8).optional(),
});

export type OutputType = { success: boolean };

export const postAdminCustomerUpdate = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/customer/update`, {
    method: "POST",
    body: superjson.stringify(input),
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