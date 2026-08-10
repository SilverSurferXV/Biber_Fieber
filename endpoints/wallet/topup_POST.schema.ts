import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  amount: z.union([
    z.literal(15),
    z.literal(25),
    z.literal(50),
    z.literal(100),
    z.literal(200),
    z.literal(500),
  ]),
  paymentMethod: z.enum(["apple_pay", "credit_card", "gpay", "klarna", "paypal"]),
});

export type OutputType = { success: boolean };

export const postWalletTopup = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/wallet/topup`, {
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