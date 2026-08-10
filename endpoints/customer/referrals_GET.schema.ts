import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Users } from "../../helpers/schema";

export const schema = z.object({});

export type OutputType = {
  referrals: (Pick<
    Selectable<Users>,
    "id" | "firstName" | "lastName" | "streetAddress" | "city" | "postcode" | "createdAt"
  > & {
    totalPointsEarned: number;
  })[];
};

export const getCustomerReferrals = async (
  input: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/customer/referrals`, {
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