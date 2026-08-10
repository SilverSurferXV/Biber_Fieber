import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { DeliveryZones } from "../../helpers/schema";

export const schema = z.object({});

export type OutputType = (Omit<Selectable<DeliveryZones>, "deliveryFee" | "minimumOrderValue" | "activationThreshold"> & {
  deliveryFee: number;
  minimumOrderValue: number;
  activationThreshold: number | null;
  cityName: string | null;
  population: number | null;
  userCount: number;
})[];

export const getAdminDeliveryZones = async (
  input: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/delivery-zones`, {
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