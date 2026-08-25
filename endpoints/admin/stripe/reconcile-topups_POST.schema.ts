import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  days: z.number().max(60).default(7).optional(),
  dryRun: z.boolean().default(true).optional(),
  paymentIntentIds: z.array(z.string()).optional(),
});

export type ReconcileItem = {
  paymentIntentId: string;
  status: string;
  amount: number;
  currency: string;
  userId: number;
  paymentMethod: string;
  createdAt: Date;
  alreadyCredited: boolean;
  creditedNow: boolean;
  pointsCredited: number | null;
  error: string | null;
  lastPaymentError: string | null;
};

export type OutputType = {
  checked: number;
  credited: number;
  items: ReconcileItem[];
};

export const postReconcileTopups = async (
  input: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/stripe/reconcile-topups`, {
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