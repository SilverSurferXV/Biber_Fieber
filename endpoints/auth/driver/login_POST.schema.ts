import { z } from "zod";
import { User } from "../../../helpers/User";
import superjson from "superjson";

export const schema = z.object({
  identifier: z.string().min(1, "Identifier (Email/Mobile) is required"),
  password: z.string().min(1, "Password is required"),
});

export type OutputType = {
  user: User;
};

export const postDriverLogin = async (
  body: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/auth/driver/login`, {
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

  return superjson.parse<OutputType>(await result.text());
};