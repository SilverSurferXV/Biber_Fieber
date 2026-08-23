import { z } from "zod";

export const schema = z.object({
  url: z.string().optional(),
  status: z.number().optional(),
  contentType: z.string().optional(),
  bodySnippet: z.string().optional(),
  href: z.string().optional(),
  origin: z.string().optional(),
  platform: z.string().optional(),
  userAgent: z.string().optional(),
  message: z.string().optional(),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { success: boolean };

// Note: No standard fetch wrapper generated here because the client intentionally uses navigator.sendBeacon