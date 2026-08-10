import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type OutputType = {
  avgShopDuration: number;
  avgPlatformDuration: number;
  totalVisitors: number;
  visitorsToday: number;
  visitorsThisWeek: number;
  visitorsThisMonth: number;
  tabClicks: { tabName: string; clickCount: number }[];
  pageVisits: { pagePath: string; visitCount: number; avgDuration: number }[];
  deliveryZoneRanking: {
    rank: number;
    postcode: string;
    cityName: string;
    totalRevenue: number;
    orderCount: number;
    avgRevenue: number;
  }[];
  weeklyOrdersPerCustomer: {
    customerName: string;
    email: string;
    totalOrders: number;
    avgOrdersPerWeek: number;
    postcode: string | null;
    cityName: string | null;
  }[];
};

export const getAdminStatistics = async (
  input: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/statistics`, {
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