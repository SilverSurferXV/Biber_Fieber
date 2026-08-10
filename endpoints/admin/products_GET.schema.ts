import { z } from "zod";
import superjson from "superjson";
import { ParsedProduct } from "../products/list_GET.schema";

export const schema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(200),
});

export type OutputType = {
  products: ParsedProduct[];
  totalCount: number;
  page: number;
  totalPages: number;
};

export const getAdminProducts = async (
    input: Partial<z.infer<typeof schema>> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const query = new URLSearchParams();
  if (input.page != null) query.set("page", String(input.page));
  if (input.limit != null) query.set("limit", String(input.limit));

  const result = await fetch(`/_api/admin/products?${query.toString()}`, {
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