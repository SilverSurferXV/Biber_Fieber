import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  email: z.string().email(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  exists: boolean;
};

export const getCheckEmail = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  
  // For GET requests, we append parameters to the URL
  const url = new URL(`/_api/auth/check-email`, window.location.href);
  url.searchParams.set("email", validatedInput.email);

  const result = await fetch(url.toString(), {
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