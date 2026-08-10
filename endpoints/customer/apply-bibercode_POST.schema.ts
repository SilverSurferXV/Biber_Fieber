import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  code: z.string().min(1, "Bitte gib einen Biber-Code ein."),
});

export type OutputType = {
  success: true;
  ownerName: string;
};

export const postApplyBibercode = async (
  body: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/customer/apply-bibercode`, {
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