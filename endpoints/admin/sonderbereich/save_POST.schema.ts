import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  id: z.number().optional(),
  title: z.string().min(1),
  description: z.string().nullable(),
  pdfUrl: z.string(),
  fileSize: z.number().nullable().optional(),
  active: z.boolean(),
});

export type OutputType = { success: boolean };

export const postAdminSonderbereichSave = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/sonderbereich/save`, {
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