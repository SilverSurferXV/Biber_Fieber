import { z } from "zod";
import superjson from "superjson";
import { OrderStatusArrayValues } from "../../../helpers/schema";

export const schema = z.object({
  orderId: z.number().int().positive(),
  status: z.enum(OrderStatusArrayValues),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
};

export const postUpdateOrderStatus = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/order/status`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error || "Failed to update order status");
  }

  return superjson.parse<OutputType>(await result.text());
};