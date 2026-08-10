import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  stops: z.array(z.object({
    address: z.string()
  })),
  startAddress: z.string().optional(),
  endAddress: z.string().optional()
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  optimizedOrder: number[];
};

export const postOptimizeRoute = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/driver/optimize-route`, {
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
    throw new Error(errorObject.error || "Failed to optimize route");
  }
  
  return superjson.parse<OutputType>(await result.text());
};