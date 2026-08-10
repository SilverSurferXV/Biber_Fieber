import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Products } from "../../helpers/schema";

export const schema = z.object({
  categoryId: z.number().optional(),
});

export type ParsedProduct = Omit<
  Pick<
    Selectable<Products>,
    | "id"
    | "articleNumber"
    | "name"
    | "categoryId"
    | "description"
    | "externalUrl"
    | "photoUrl"
    | "priceNet"
    | "priceNet2"
    | "priceNet3"
    | "taxRate"
  | "costPriceEuro"
  | "costPriceEuro2"
  | "costPriceEuro3"
  | "costPricePercent"
    | "quantityDiscounts"
    | "active"
    | "sortOrder"
    | "isNew"
    | "newDurationDays"
    | "newMarkedAt"
    | "createdAt"
    | "updatedAt"
    | "supplier"
    | "weight"
    | "isVegan"
    | "isBio"
    | "isGlutenFree"
    | "isVegetarian"
  >,
  "priceNet" | "priceNet2" | "priceNet3" | "taxRate" | "costPriceEuro" | "costPriceEuro2" | "costPriceEuro3" | "costPricePercent"
> & {
  priceNet: number;
  priceNet2: number | null;
  priceNet3: number | null;
  taxRate: number | null;
  costPriceEuro: number | null;
  costPriceEuro2: number | null;
  costPriceEuro3: number | null;
    costPricePercent: number | null;
  categoryName: string | null;
  averageRating: number | null;
  thumbnailUrl: string | null;
};

export type OutputType = ParsedProduct[];

export const getProductsList = async (
  input: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const query = new URLSearchParams();
  if (input.categoryId !== undefined) query.set("categoryId", String(input.categoryId));

  const result = await fetch(`/_api/products/list?${query.toString()}`, {
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