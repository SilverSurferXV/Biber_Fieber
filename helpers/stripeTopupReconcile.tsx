import Stripe from "stripe";
import { db } from "./db";
import { creditWalletTopup } from "./creditWalletTopup";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
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

export type ReconcileResult = {
  checked: number;
  credited: number;
  items: ReconcileItem[];
};

export async function stripeTopupReconcile({
  days = 7,
  dryRun = true,
  paymentIntentIds,
}: {
  days?: number;
  dryRun?: boolean;
  paymentIntentIds?: string[];
}): Promise<ReconcileResult> {
  let intents: Stripe.PaymentIntent[] = [];
  
  if (paymentIntentIds && paymentIntentIds.length > 0) {
    for (const id of paymentIntentIds) {
      try {
        const pi = await stripe.paymentIntents.retrieve(id);
        intents.push(pi);
      } catch (e: any) {
        console.error(`Failed to retrieve payment intent ${id}:`, e);
      }
    }
  } else {
    const createdGte = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
    try {
      const response = await stripe.paymentIntents.list({
        limit: 100,
        created: { gte: createdGte },
      });
      intents = response.data;
    } catch (e: any) {
      console.error("Failed to list payment intents:", e);
      throw new Error("Failed to list payment intents from Stripe.");
    }
  }

  const items: ReconcileItem[] = [];
  let checked = 0;
  let creditedCount = 0;

  for (const intent of intents) {
    if (!intent.metadata || !intent.metadata.userId) {
      continue;
    }
    
    checked++;

    const amount = intent.amount / 100;
    const userId = Number(intent.metadata.userId);
    const paymentMethod = intent.metadata.paymentMethod ?? "credit_card";
    
    let alreadyCredited = false;
    
    const existingTransaction = await db
      .selectFrom("pointTransactions")
      .select("id")
      .where("note", "like", `%${intent.id}%`)
      .executeTakeFirst();
      
    if (existingTransaction) {
      alreadyCredited = true;
    }

    let creditedNow = false;
    let pointsCredited: number | null = null;
    let errorStr: string | null = null;

    if (intent.status === "succeeded" && !alreadyCredited) {
      if (!dryRun) {
        try {
          const res = await creditWalletTopup({
            customerId: userId,
            amount,
            paymentIntentId: intent.id,
            paymentMethod,
          });
          creditedNow = true;
          pointsCredited = res.pointsCredited;
          creditedCount++;
        } catch (e: any) {
          if (e.message === "Payment already processed.") {
            alreadyCredited = true;
          } else {
            errorStr = e.message;
            console.error(`Error crediting ${intent.id}:`, e);
          }
        }
      }
    }

    items.push({
      paymentIntentId: intent.id,
      status: intent.status,
      amount,
      currency: intent.currency,
      userId,
      paymentMethod,
      createdAt: new Date(intent.created * 1000),
      alreadyCredited,
      creditedNow,
      pointsCredited,
      error: errorStr,
      lastPaymentError: intent.last_payment_error?.message ?? null,
    });
  }

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    checked,
    credited: creditedCount,
    items,
  };
}