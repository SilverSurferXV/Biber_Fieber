import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  nameEn: z.string().nullable().optional(),
  nameEs: z.string().nullable().optional(),
  nameIt: z.string().nullable().optional(),
  nameTr: z.string().nullable().optional(),
  photoUrl: z.string().nullable(),
  sortOrder: z.number().nullable(),
  active: z.boolean(),
});

export type OutputType = { success: boolean };

export const postAdminCategorySave = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/category/save`, {
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