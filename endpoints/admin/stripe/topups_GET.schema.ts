import { z } from "zod";
import superjson from "superjson";
import { PaymentMethodType } from "../../../helpers/schema";

export const schema = z.object({});

export type TopupRecord = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  amount: number;
  bonusPercent: number | null;
  pointsCredited: number;
  paymentMethod: PaymentMethodType | null;
  topupDate: Date | null;
};

export type OutputType = TopupRecord[];

export const getStripeTopups = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/stripe/topups`, {
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