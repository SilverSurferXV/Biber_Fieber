import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  page: z.coerce.number().default(1),
  pageSize: z.coerce.number().max(100).default(100),
  search: z.string().optional(),
  status: z.enum(["all", "success", "failed"]).default("all"),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  rows: Array<{
    id: number;
    attemptedAt: Date | null;
    email: string;
    success: boolean | null;
    userId: number | null;
    displayName: string | null;
    firstName: string | null;
    lastName: string | null;
    role: "admin" | "user" | "driver" | null;
    ipAddress: string | null;
    userAgent: string | null;
    clientPlatform: string | null;
    loginSource: string | null;
    location: {
      city: string | null;
      region: string | null;
      country: string | null;
      countryCode: string | null;
      isPrivate: boolean;
      failed: boolean;
    } | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
};

export const getAdminLoginHistory = async (
  input: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validated = schema.parse(input);
  const params = new URLSearchParams({
    page: String(validated.page),
    pageSize: String(validated.pageSize),
    status: validated.status,
  });
  
  if (validated.search) {
    params.set("search", validated.search);
  }

  const result = await fetch(`/_api/admin/login-history?${params.toString()}`, {
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