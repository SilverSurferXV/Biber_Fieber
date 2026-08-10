import { z } from "zod";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;
export type OutputType = string;

export const getSw = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/sw`, {
    method: "GET",
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    throw new Error(await result.text());
  }
  return result.text();
};