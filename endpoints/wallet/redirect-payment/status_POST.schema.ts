import { z } from "zod";
import superjson from "superjson";
import { paymentMethodSchema } from "../create-payment-intent_POST.schema";

export const schema = z.object({
  paymentIntentId: z.string(),
  amount: z.union([
    z.literal(15),
    z.literal(25),
    z.literal(50),
    z.literal(100),
    z.literal(200),
    z.literal(500),
  ]),
  paymentMethod: paymentMethodSchema,
});

export type OutputType = {
  status: string;
  credited: boolean;
  pointsCredited: number | null;
};

export const postRedirectTopupStatus = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/wallet/redirect-payment/status`, {
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