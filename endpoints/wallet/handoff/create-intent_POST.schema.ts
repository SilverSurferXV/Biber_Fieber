import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  token: z.string(),
});

export type OutputType = {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  bonusPercent: number;
  pointsToCredit: number;
};

export const postHandoffCreateIntent = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/wallet/handoff/create-intent`, {
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