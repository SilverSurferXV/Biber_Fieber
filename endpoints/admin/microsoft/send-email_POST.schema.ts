import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  to: z.string().email("Invalid email format"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Email body is required"),
});

export type OutputType = {
  success: boolean;
};

export const postMicrosoftSendEmail = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/microsoft/send-email`, {
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