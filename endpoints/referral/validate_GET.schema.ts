import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  code: z.string().optional(),
});

export type OutputType = {
  found: boolean;
  ownerName: string | null;
};

export const getValidateBibercode = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(input);
  
  // Create URL and append query parameters
  // Using a dummy base URL since we only need the path and search params for the fetch call
  const url = new URL("/_api/referral/validate", "http://localhost");
  if (validatedInput.code) {
    url.searchParams.set("code", validatedInput.code);
  }

  const result = await fetch(url.pathname + url.search, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    try {
      const errorObject = superjson.parse<{ error: string }>(await result.text());
      throw new Error(errorObject.error);
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error("Failed to validate Bibercode");
    }
  }
  
  return superjson.parse<OutputType>(await result.text());
};