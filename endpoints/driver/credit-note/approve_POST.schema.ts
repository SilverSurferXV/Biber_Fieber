import { z } from "zod";
import superjson from "superjson";
import { CreditNoteStatus } from "../../../helpers/schema";

export const schema = z.object({
  creditNoteId: z.number(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  status: CreditNoteStatus;
};

export const postApproveCreditNote = async (
  body: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/driver/credit-note/approve`, {
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
    throw new Error(errorObject.error || "Failed to approve credit note");
  }
  return superjson.parse<OutputType>(await result.text());
};