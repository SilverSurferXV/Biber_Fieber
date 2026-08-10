import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  email: z.string().email("Invalid email"),
  role: z.enum(["admin", "user"]),
});

export type OutputType = {
  success: boolean;
  userId: number;
};

export const postAdminAdminRole = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/admin/role`, {
    method: "POST",
    body: superjson.stringify(input),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error || "Failed to update role");
  }

  return superjson.parse<OutputType>(await result.text());
};