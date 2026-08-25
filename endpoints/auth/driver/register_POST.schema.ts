import { z } from "zod";
import { User } from "../../../helpers/User";
import superjson from "superjson";
import { nativeSessionToken } from "../../../helpers/nativeSessionToken";

export const schema = z.object({
  email: z.string().email("Email is required"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  mobileNumber: z.string().min(1, "Mobile number is required"),
});

export type OutputType = {
  user: User;
  sessionToken?: string;
};

export const postDriverRegister = async (
  body: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/auth/driver/register`, {
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
    throw new Error(errorData.message || "Registration failed");
  }

  const parsed = superjson.parse<OutputType>(await result.text());
  if (parsed.sessionToken) {
    nativeSessionToken.set(parsed.sessionToken);
  }
  return parsed;
};