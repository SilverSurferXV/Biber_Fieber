import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  id: z.number().optional(),
  postcodePattern: z.string().min(1),
  cityName: z.string().optional(),
  population: z.number().optional(),
  deliveryFee: z.number().optional(),
  minimumOrderValue: z.number(),
  activationThreshold: z.number().optional(),
  active: z.boolean(),
});

export type OutputType = { success: boolean };

export const postAdminDeliveryZoneSave = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/delivery-zone/save`, {
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