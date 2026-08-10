import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type OutputType = {
  postcodePattern: string;
  cityName: string | null;
  activationThreshold: number | null;
  userCount: number;
  active: boolean | null;
}[];

export const getDeliveryZonesList = async (
  input: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/delivery-zones/list`, {
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