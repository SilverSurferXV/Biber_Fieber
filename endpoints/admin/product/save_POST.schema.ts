import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  articleNumber: z.string().min(1),
  categoryId: z.number().nullable(),
  description: z.string().nullable(),
  externalUrl: z.string().nullable(),
  photoUrl: z.string().nullable(),
  thumbnailUrl: z.string().nullable().optional(),
  priceNet: z.number(),
  priceNet2: z.number().nullable(),
  priceNet3: z.number().nullable(),
  taxRate: z.number().nullable(),
  costPriceEuro: z.number().nullable(),
  costPriceEuro2: z.number().nullable(),
  costPriceEuro3: z.number().nullable(),
  costPricePercent: z.number().nullable(),
  active: z.boolean(),
  isNew: z.boolean(),
  supplier: z.string().nullable(),
  sortOrder: z.number().nullable(),
  quantityDiscounts: z.union([z.record(z.string(), z.number()), z.array(z.any())]).nullable(),
  newDurationDays: z.number().nullable(),
  weight: z.string().nullable(),
  originalPhotoSizeBytes: z.number().nullable(),
  compressedPhotoSizeBytes: z.number().nullable(),
  isVegan: z.boolean(),
  isBio: z.boolean(),
  isGlutenFree: z.boolean(),
  isVegetarian: z.boolean(),
});

export type OutputType = { success: boolean };

export const postAdminProductSave = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/product/save`, {
    method: "POST",
    body: superjson.stringify(input),
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