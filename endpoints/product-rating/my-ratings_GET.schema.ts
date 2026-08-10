import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type Rating = {
  productId: number;
  tasteRating: number;
  qualityRating: number;
  priceRating: number;
};

export type OutputType = {
  ratings: Rating[];
};

export const getProductRatingMyRatings = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/product-rating/my-ratings`, {
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