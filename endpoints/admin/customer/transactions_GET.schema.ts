import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { PointTransactions } from '../../../helpers/schema';

export const schema = z.object({
  customerId: z.number()
});

export type OutputType = (Omit<Selectable<PointTransactions>, "amount"> & {
  amount: number;
})[];

export const getAdminCustomerTransactions = async (
input: z.infer<typeof schema>,
init?: RequestInit)
: Promise<OutputType> => {
  const searchParams = new URLSearchParams({
    customerId: input.customerId.toString()
  });

  const result = await fetch(`/_api/admin/customer/transactions?${searchParams.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{error: string;}>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};