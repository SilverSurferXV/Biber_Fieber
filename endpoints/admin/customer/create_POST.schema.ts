import { z } from "zod";
import superjson from "superjson";
import { LanguagePreferenceArrayValues, NotificationPreferenceArrayValues } from '../../../helpers/schema';

export const schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  streetAddress: z.string().optional(),
  city: z.string().optional(),
  postcode: z.string().optional(),
  mobileNumber: z.string().optional(),
  dateOfBirth: z.string().optional(), // ISO string format expected (e.g. YYYY-MM-DD)
  referralCode: z.string().optional(),
  languagePreference: z.enum(LanguagePreferenceArrayValues).optional(),
 notificationPreference: z.enum(NotificationPreferenceArrayValues).optional(),
  companyName: z.string().optional(),
  salutation: z.string().optional()
});

export type OutputType = {
  success: boolean;
  userId: number;
};

export const postAdminCustomerCreate = async (
body: z.infer<typeof schema>,
init?: RequestInit)
: Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/customer/create`, {
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
    throw new Error(errorObject.error || "Failed to create customer");
  }

  return superjson.parse<OutputType>(await result.text());
};