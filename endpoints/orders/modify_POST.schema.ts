import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  orderId: z.number(),
  items: z
    .array(
      z.object({
        productId: z.number(),
        quantity: z.number().min(1),
      })
    )
    .min(1),
  deliveryDate: z.string().optional(), // YYYY-MM-DD
  preferredDeliveryDay: z.string().optional().nullable(),
  deliveryNote: z.string().optional().nullable(),
});

export type OutputType = {
  success: boolean;
  orderNumber: string;
};

export const postModifyOrder = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/orders/modify`, {
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