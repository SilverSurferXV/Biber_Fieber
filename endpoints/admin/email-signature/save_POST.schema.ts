import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { EmailSignatures } from "../../../helpers/schema";

export const schema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  content: z.string().min(1),
});

export type OutputType = Selectable<EmailSignatures>;

export const postAdminEmailSignatureSave = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/email-signature/save`, {
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