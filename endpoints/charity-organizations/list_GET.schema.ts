import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { CharityOrganizations } from "../../helpers/schema";

export const schema = z.object({});

export type OutputType = Pick<
  Selectable<CharityOrganizations>,
  "id" | "name" | "description"
>[];

export const getCharityOrganizations = async (
  input: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/charity-organizations/list`, {
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