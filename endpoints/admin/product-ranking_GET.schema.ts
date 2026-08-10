import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type ProductRankingItem = {
  rank: number;
  productId: number;
  name: string;
  articleNumber: string;
  photoUrl: string | null;
  categoryName: string | null;
  totalSold: number;
  totalRevenue: number;
  active: boolean;
};

export type OutputType = ProductRankingItem[];

export const getAdminProductRanking = async (
  input: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(input);
  const url = new URL("/_api/admin/product-ranking", window.location.origin);
  if (validatedInput.startDate) {
    url.searchParams.set("startDate", validatedInput.startDate);
  }
  if (validatedInput.endDate) {
    url.searchParams.set("endDate", validatedInput.endDate);
  }

  const result = await fetch(url.toString(), {
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