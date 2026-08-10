import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number(),
        quantity: z.number().min(1),
      })
    )
    .min(1),
  paymentMethod: z.enum(["apple_pay", "credit_card", "gpay", "klarna", "paypal", "points"]),
  deliveryDate: z.string().optional(), // YYYY-MM-DD
  deliveryNote: z.string().optional().nullable(),
  preferredDeliveryDay: z.string().optional().nullable(), // weekday key e.g. "monday"
});

export type OutputType = {
  success: boolean;
  orderNumber: string;
};

export const postCheckout = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/cart/checkout`, {
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