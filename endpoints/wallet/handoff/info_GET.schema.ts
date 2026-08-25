import { z } from "zod";
import superjson from "superjson";

export const topupHandoffStatusSchema = z.enum(["completed", "expired", "pending"]);
export type TopupHandoffStatus = z.infer<typeof topupHandoffStatusSchema>;

export const schema = z.object({
  token: z.string(),
});

export type OutputType = {
  status: TopupHandoffStatus;
  amount: number;
  bonusPercent: number;
  pointsToCredit: number;
  pointsCredited: number | null;
  firstName: string;
  expiresAt: Date;
};

export const getHandoffInfo = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/wallet/handoff/info?token=${encodeURIComponent(input.token)}`, {
    method: "GET",
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};