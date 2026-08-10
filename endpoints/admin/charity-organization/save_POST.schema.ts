import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  active: z.boolean().default(true),
  streetAddress: z.string().nullable().optional(),
  postcode: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  bankDetails: z.string().nullable().optional(),
  contactPerson: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  registerNumber: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = { success: boolean; id: number };

export const postAdminCharityOrganizationSave = async (
  input: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(input);
  const result = await fetch(`/_api/admin/charity-organization/save`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
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