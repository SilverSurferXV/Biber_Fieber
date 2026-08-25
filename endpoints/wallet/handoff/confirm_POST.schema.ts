import { z } from "zod";
import superjson from "superjson";
import { paymentMethodSchema } from "../create-payment-intent_POST.schema";

export const schema = z.object({
  token: z.string(),
  paymentIntentId: z.string(),
  paymentMethod: paymentMethodSchema,
});

export type OutputType = {
  success: boolean;
  pointsCredited: number;
};

export const postHandoffConfirm = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/wallet/handoff/confirm`, {
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