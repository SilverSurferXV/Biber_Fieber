import { z } from "zod";
import superjson from "superjson";

export const paymentMethodSchema = z.enum([
  "gpay", 
  "apple_pay", 
  "klarna", 
  "klarna_sofort", 
  "paypal", 
  "credit_card"
]);

export const schema = z.object({
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
  clientSecret: string;
  paymentIntentId: string;
};

export const postCreatePaymentIntent = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/wallet/create-payment-intent`, {
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