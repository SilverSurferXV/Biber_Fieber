import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  streetAddress: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  postcode: z.string().nullable().optional(),
  mobileNumber: z.string().nullable().optional(),
  languagePreference: z.enum(["de", "en", "es", "it", "tr"]).nullable().optional(),
  notificationPreference: z.enum(["both", "email", "sms"]).nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  dropoffDescription: z.string().nullable().optional(),
  dropoffPhotoUrl: z.string().nullable().optional(),
  salutation: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),
  newsletterOptIn: z.boolean().optional(),
  deliveryAddressSameAsBilling: z.boolean().optional(),
  deliveryCompanyName: z.string().nullable().optional(),
  deliveryFirstName: z.string().nullable().optional(),
  deliveryLastName: z.string().nullable().optional(),
  deliveryStreet: z.string().nullable().optional(),
  deliveryPostcode: z.string().nullable().optional(),
  deliveryCity: z.string().nullable().optional(),
  deliveryMobileNumber: z.string().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
});

export type OutputType = { success: boolean };

export const postCustomerProfileUpdate = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/customer/profile/update`, {
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