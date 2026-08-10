import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM format"),
});

export type OutputType = {
  month: string;
  organization: {
    name: string;
    streetAddress: string | null;
    postcode: string | null;
    city: string | null;
    contactPerson: string | null;
    registerNumber: string | null;
    logoUrl: string | null;
  };
  customerName: string;
  customerAddress: string;
  orders: Array<{
    orderNumber: string;
    orderDate: string;
    netSubtotal: number;
    donationAmount: number;
  }>;
  totalNetSubtotal: number;
  totalDonation: number;
};

export const getCustomerDonationReceipt = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const query = new URLSearchParams({ month: input.month });
  const result = await fetch(`/_api/customer/donation-receipt?${query.toString()}`, {
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