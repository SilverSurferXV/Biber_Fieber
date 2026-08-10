import { z } from "zod";
import superjson from 'superjson';

export const schema = z.object({});

export type DriverRatingAggregated = {
  driverId: number;
  driverName: string;
  avgClean: number;
  avgNoise: number;
  avgPlacement: number;
  totalRatings: number;
  totalTips: number;
};

export type OutputType = DriverRatingAggregated[];

export const getAdminDriverRatings = async (
  input: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/driver-ratings`, {
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