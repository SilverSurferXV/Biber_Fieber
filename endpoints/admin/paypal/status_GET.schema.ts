import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type TopupRecord = {
  id: number;
  amount: number;
  bonusPercent: number | null;
  pointsCredited: number;
  topupDate: Date | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

export type OutputType = {
  connected: boolean;
  mode: string;
  clientId: string;
  error?: string;
  recentTopups: TopupRecord[];
};

export const getPaypalStatus = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/paypal/status`, {
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