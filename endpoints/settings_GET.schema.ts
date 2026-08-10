import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { AppSettings } from '../helpers/schema';

export const schema = z.object({});

type ParsedSettings = Omit<Selectable<AppSettings>, "shopLatitude" | "shopLongitude" | "freeDeliveryThreshold" | "deliveryFee"> & {
  shopLatitude: number | null;
  shopLongitude: number | null;
  freeDeliveryThreshold: number | null;
  deliveryFee: number | null;
};

export type OutputType = ParsedSettings;

export const getSettings = async (
input: z.infer<typeof schema> = {},
init?: RequestInit)
: Promise<OutputType> => {
  const result = await fetch(`/_api/settings`, {
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