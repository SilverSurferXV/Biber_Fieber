import { z } from "zod";
import superjson from "superjson";
import { OrderWithItems } from "../orders/list_GET.schema";

export const schema = z.object({
  date: z.string().optional(), // YYYY-MM-DD
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(50),
});

export type OrderItemWithSupplier = OrderWithItems["items"][number] & {
  supplier: string | null;
  articleNumber: string | null;
};

export type OrderWithItemsAndCustomer = Omit<OrderWithItems, "items"> & {
  items: OrderItemWithSupplier[];
  customerName: string | null;
  customerStreet: string | null;
  customerCity: string | null;
  customerPostcode: string | null;
  customerMobile: string | null;
  wareneinsatz: number | null;
  db1: number | null;
};

export type OutputType = {
  orders: OrderWithItemsAndCustomer[];
  summary: Record<string, number>;
  totalCount: number;
  page: number;
  totalPages: number;
};

export const getAdminOrders = async (
    input: Partial<z.infer<typeof schema>> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const query = new URLSearchParams();
  if (input.date !== undefined) query.set("date", input.date);
  if (input.page !== undefined) query.set("page", String(input.page));
  if (input.limit !== undefined) query.set("limit", String(input.limit));

  const result = await fetch(`/_api/admin/orders?${query.toString()}`, {
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