import { z } from "zod";
import superjson from 'superjson';

export const schema = z.object({});

export type ProductRatingAggregated = {
  productId: number;
  productName: string;
  articleNumber: string;
  avgTaste: number;
  avgQuality: number;
  avgPrice: number;
  totalRatings: number;
};

export type OutputType = ProductRatingAggregated[];

export const getAdminProductRatings = async (
  input: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/product-ratings`, {
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