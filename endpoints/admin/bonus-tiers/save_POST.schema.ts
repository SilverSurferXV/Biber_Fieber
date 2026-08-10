import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  tiers: z
    .array(
      z.object({
        amount: z.number().positive("Amount must be a positive number"),
        bonusPercent: z.number().min(0, "Bonus percent must be at least 0"),
      })
    )
    .refine(
      (tiers) => {
        const amounts = tiers.map((t) => t.amount);
        return new Set(amounts).size === amounts.length;
      },
      {
        message: "Bonus tier amounts must be unique",
      }
    ),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { success: boolean };

export const postAdminBonusTiersSave = async (
  input: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/bonus-tiers/save`, {
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
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};