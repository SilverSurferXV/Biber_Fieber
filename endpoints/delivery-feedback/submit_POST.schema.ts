import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  orderId: z.number(),
  tipAmount: z.union([z.literal(0), z.literal(0.5), z.literal(1), z.literal(2)]).optional().default(0),
  cleanRating: z.number().min(1).max(5),
  noiseRating: z.number().min(1).max(5),
  placementRating: z.number().min(1).max(5),
});

export type OutputType = {
  success: boolean;
};

export const postDeliveryFeedbackSubmit = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/delivery-feedback/submit`, {
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