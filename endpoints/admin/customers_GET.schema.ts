import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Users } from "../../helpers/schema";

export const schema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(100),
  search: z.string().optional(),
  businessOnly: z.coerce.boolean().optional(),
  excludeBusiness: z.coerce.boolean().optional(),
});

export type InputType = z.infer<typeof schema>;

type CustomerItem = Omit<Selectable<Users>, "pointsBalance" | "avatarUrl"> & {
  pointsBalance: number | null;
  avatarUrl: null;
};

export type OutputType = {
  customers: CustomerItem[];
  totalCount: number;
  page: number;
  totalPages: number;
};

export const getAdminCustomers = async (
  input: Partial<InputType> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const validated = schema.parse(input);
  const params = new URLSearchParams({
    page: String(validated.page),
    limit: String(validated.limit),
  });
    if (validated.search) {
    params.set("search", validated.search);
  }
  if (validated.businessOnly) {
    params.set("businessOnly", "true");
  }
  if (validated.excludeBusiness) {
    params.set("excludeBusiness", "true");
  }

  const result = await fetch(`/_api/admin/customers?${params.toString()}`, {
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