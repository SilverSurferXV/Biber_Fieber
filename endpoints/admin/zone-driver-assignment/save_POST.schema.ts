import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  dateKey: z.string(),
  postcode: z.string(),
  driverId: z.number().int().positive().nullable(),
  carType: z.string().nullable(),
  packer: z.string().nullable().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
};

export const postSaveZoneDriverAssignment = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/zone-driver-assignment/save`, {
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
    throw new Error(errorObject.error || "Failed to save driver assignment");
  }

  return superjson.parse<OutputType>(await result.text());
};