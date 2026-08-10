import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  customerId: z.coerce.number(),
});

export type AdminCustomerOrder = {
  id: number;
  orderNumber: string;
  orderDate: Date | null;
  total: number | null;
  status: string | null;
};

export type OutputType = {
  orders: AdminCustomerOrder[];
};

export const getAdminCustomerOrders = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const query = new URLSearchParams({ customerId: input.customerId.toString() });

  const result = await fetch(`/_api/admin/customer/orders?${query.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error || "Failed to fetch customer orders");
  }

  return superjson.parse<OutputType>(await result.text());
};