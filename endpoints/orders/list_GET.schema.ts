import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Orders, OrderItems } from "../../helpers/schema";

export const schema = z.object({});

type ParsedOrderItem = Omit<Selectable<OrderItems>, "unitPrice" | "taxRate"> & {
  unitPrice: number;
  taxRate: number | null;
};

type ParsedOrder = Omit<Selectable<Orders>, "subtotal" | "deliveryFee" | "total" | "pointsEarned" | "pointsUsed" | "bibercodePointsCredited"> & {
  subtotal: number | null;
  deliveryFee: number | null;
  total: number | null;
  pointsEarned: number | null;
  pointsUsed: number | null;
  bibercodePointsCredited: number | null;
};

export type OrderWithItems = ParsedOrder & {
  items: ParsedOrderItem[];
};

export type OutputType = OrderWithItems[];

export const getCustomerOrders = async (
  input: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/orders/list`, {
    method: "GET",
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