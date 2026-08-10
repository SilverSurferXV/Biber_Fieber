import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  driverId: z.number(),
});

export type DailyEarning = {
  date: string;
  stopsCount: number;
  earnings: number;
};

export type PackagingDay = {
  date: string;
};

export type OutputType = {
  stopCompensation: number;
  dailyEarnings: DailyEarning[];
  totalEarnings: number;
  totalStops: number;
  packagingCompensation: number;
  packagingDays: PackagingDay[];
  totalPackagingEarnings: number;
  driverPointsBalance: number;
  totalTipsReceived: number;
};

export const getAdminDriverEarnings = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const params = new URLSearchParams();
  params.set("driverId", input.driverId.toString());

  const result = await fetch(`/_api/admin/driver/earnings?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error || "Failed to fetch driver earnings");
  }

  return superjson.parse<OutputType>(await result.text());
};