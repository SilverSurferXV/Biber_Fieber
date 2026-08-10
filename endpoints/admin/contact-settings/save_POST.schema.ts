import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  contactFromEmail: z.string().email(),
  contactFromName: z.string().min(1),
  contactToEmail: z.string().email(),
  contactToName: z.string().min(1),
});

export type OutputType = {
  success: boolean;
};

export const postAdminContactSettingsSave = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/contact-settings/save`, {
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