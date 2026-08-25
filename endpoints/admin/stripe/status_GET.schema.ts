import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type OutputType = 
  | { connected: true; livemode?: boolean }
  | { connected: false; error: string };

export const getStripeStatus = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/stripe/status`, {
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