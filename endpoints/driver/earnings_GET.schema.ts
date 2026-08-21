import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type DailyEarning = {
  date: string;
  stopsCount: number;
  companyCarStops?: number;
  grossEarnings?: number;
  carDeduction?: number;
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
  totalCompanyCarStops?: number;
  totalGrossEarnings?: number;
  totalCarDeduction?: number;
  packagingCompensation: number;
  packagingDays: PackagingDay[];
  totalPackagingEarnings: number;
  driverPointsBalance: number;
  totalTipsReceived: number;
};

export const getDriverEarnings = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/driver/earnings`, {
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