import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  sessionId: z.string().min(1),
  eventType: z.enum(["page_visit", "tab_click"]),
  pagePath: z.string().min(1),
  tabName: z.string().optional(),
  durationSeconds: z.number().optional()
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { success: boolean };

export const postTrackingEvent = async (
  input: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(input);
  const result = await fetch(`/_api/tracking/event`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
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