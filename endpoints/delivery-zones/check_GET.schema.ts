import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { DeliveryZones } from "../../helpers/schema";

export const schema = z.object({
  postcode: z.string().min(1),
  checkThreshold: z.boolean().optional().default(false),
});

export type OutputType = {
  deliveryFee: number;
  minimumOrderValue: number;
} | null;

export const getDeliveryZoneCheck = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const query = new URLSearchParams({ postcode: input.postcode });
  if (input.checkThreshold) {
    query.set("checkThreshold", "true");
  }
  const result = await fetch(`/_api/delivery-zones/check?${query.toString()}`, {
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