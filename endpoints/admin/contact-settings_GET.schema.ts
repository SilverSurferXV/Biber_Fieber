import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type OutputType = {
  contactFromEmail: string;
  contactFromName: string;
  contactToEmail: string;
  contactToName: string;
};

export const getAdminContactSettings = async (
  input: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/contact-settings`, {
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