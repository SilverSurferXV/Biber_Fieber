import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { CharityOrganizations } from "../../helpers/schema";

export const schema = z.object({});

export type OutputType = (Omit<Selectable<CharityOrganizations>, "totalPointsEarned"> & {
  totalPointsEarned: number;
})[];

export const getAdminCharityOrganizations = async (
  input: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/charity-organizations`, {
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