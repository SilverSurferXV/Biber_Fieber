import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  paymentIntentId: z.string(),
});

export type OutputType = {
  status: string;
  credited: boolean;
  alreadyCredited: boolean;
  pointsCredited: number | null;
};

export const postCompleteRedirectTopup = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/wallet/redirect-payment/complete`, {
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