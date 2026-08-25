import { z } from "zod";
import superjson from "superjson";
import { nativeSessionToken } from "../../helpers/nativeSessionToken";

// No input required for logout
export const schema = z.object({});

export type OutputType =
  | {
      success: boolean;
      message: string;
    }
  | {
      error: string;
      message?: string;
    };

export const postLogout = async (
  body: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/auth/logout`, {
    method: "POST",
    body: superjson.stringify(body),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  nativeSessionToken.clear();
  return superjson.parse<OutputType>(await result.text());
};