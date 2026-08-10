import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type OutputType = Array<{
  orderId: number;
  orderNumber: string;
  driverFirstName: string | null;
  driverLastName: string | null;
  deliveryDate: string | null;
}>;

export const getDeliveryFeedbackPending = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/delivery-feedback/pending`, {
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