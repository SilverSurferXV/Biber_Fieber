import { z } from "zod";
import superjson from "superjson";
import { OrderWithItems } from "../orders/list_GET.schema";

export const schema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM format"),
});

export type InvoiceDayGroup = {
  date: string; // YYYY-MM-DD
  orders: OrderWithItems[];
};

export type InvoiceCustomer = {
  id: number;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  streetAddress: string | null;
  postcode: string | null;
  city: string | null;
  companyName: string | null;
};

export type OutputType = {
  month: string;
  total: number;
  totalBibercodePointsEarned: number;
  totalTopupBonusPoints: number;
  customer: InvoiceCustomer;
  days: InvoiceDayGroup[];
};

export const getCustomerInvoice = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const query = new URLSearchParams({ month: input.month });
  const result = await fetch(`/_api/customer/invoice?${query.toString()}`, {
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