import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  defaultLanguage: z.enum(["de", "en", "es", "it", "tr"]).nullable(),
  deliveryDays: z.any().nullable(),
  deliveryTimeWindow: z.string().nullable(),
  facebookUrl: z.string().nullable(),
  instagramUrl: z.string().nullable(),
  openingHours: z.any().nullable(),
  orderCutoffTime: z.string().nullable(),
  shopLatitude: z.number().nullable(),
  shopLocation: z.string().nullable(),
  shopLongitude: z.number().nullable(),
  tiktokUrl: z.string().nullable(),
  whatsappNumber: z.string().nullable(),
  youtubeUrl: z.string().nullable(),
  freeDeliveryThreshold: z.number().nullable(),
  deliveryFee: z.number().nullable(),
});

export type OutputType = { success: boolean };

export const postAdminSettingsSave = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/settings/save`, {
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