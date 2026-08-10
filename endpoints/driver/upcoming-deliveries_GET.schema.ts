import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type UpcomingDeliveryGroup = {
  date: string;
  postcode: string;
  cityName: string | null;
  stopCount: number;
};

export type OutputType = {
  deliveries: UpcomingDeliveryGroup[];
};

export const getUpcomingDeliveries = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/driver/upcoming-deliveries`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error || "Failed to fetch upcoming deliveries");
  }

  return superjson.parse<OutputType>(await result.text());
};