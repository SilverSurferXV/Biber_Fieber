import { z } from "zod";
import superjson from "superjson";
import { User } from "../../helpers/User";
import { nativeSessionToken } from "../../helpers/nativeSessionToken";

// no schema, just a simple GET request
export const schema = z.object({});

export type OutputType =
  | {
      user: User;
      sessionToken?: string;
    }
  | {
      error: string;
    };

export const getSession = async (
  body: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/auth/session`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const parsed = superjson.parse<OutputType>(await result.text());
  if ("user" in parsed && parsed.sessionToken) {
    nativeSessionToken.set(parsed.sessionToken);
  }
  return parsed;
};