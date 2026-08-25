import { z } from "zod";
import { User } from "../../helpers/User";
import superjson from "superjson";
import { nativeSessionToken } from "../../helpers/nativeSessionToken";

export const schema = z.object({
  email: z.string().email("Email is required"),
  password: z.string().min(1, "Password is required"),
  clientPlatform: z.string().max(32).optional(),
});

export type OutputType = {
  user: User;
  sessionToken?: string;
};

export const postLogin = async (
  body: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/auth/login_with_password`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include", // Important for cookies to be sent and received
  });

  if (!result.ok) {
    const errorData = superjson.parse<{ message: string }>(await result.text());
    throw new Error(errorData.message || "Login failed");
  }

  const parsed = superjson.parse<OutputType>(await result.text());
  if (parsed.sessionToken) {
    nativeSessionToken.set(parsed.sessionToken);
  }
  return parsed;
};