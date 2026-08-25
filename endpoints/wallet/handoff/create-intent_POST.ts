import { schema, OutputType } from "./create-intent_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getBonusTiers } from "../../../helpers/creditWalletTopup";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const row = await db.selectFrom("topupHandoffTokens")
      .selectAll()
      .where("token", "=", input.token)
      .executeTakeFirst();

    if (!row) {
      throw new Error("Token not found");
    }

    const now = new Date();
    if (row.status !== "pending") {
      throw new Error(`Token is not pending. Status: ${row.status}`);
    }

    if (new Date(row.expiresAt) < now) {
      await db.updateTable("topupHandoffTokens")
        .set({ status: "expired" })
        .where("id", "=", row.id)
        .execute();
      throw new Error("Token expired");
    }

    const amountNum = Number(row.amount);
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountNum * 100, // Stripe expects cents for EUR
      currency: "eur",
      payment_method_types: ["card"],
      metadata: {
        userId: row.customerId.toString(),
        amount: amountNum.toString(),
        handoffToken: input.token,
        source: "native_handoff",
        acceptsWallets: "true",
      },
    });

    if (!paymentIntent.client_secret) {
      throw new Error("Failed to create payment intent: Missing client_secret");
    }

    await db.updateTable("topupHandoffTokens")
      .set({ paymentIntentId: paymentIntent.id })
      .where("id", "=", row.id)
      .execute();

    const bonusTiers = await getBonusTiers();
    const matchedTier = bonusTiers.find((t) => t.amount === amountNum);
    const bonusPercent = matchedTier ? matchedTier.bonusPercent : 0;
    const pointsToCredit = amountNum * (1 + bonusPercent / 100);

    return new Response(
      superjson.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: amountNum,
        bonusPercent,
        pointsToCredit,
      } satisfies OutputType)
    );
  } catch (error: any) {
    console.error("handoff create-intent error:", error);
    return new Response(superjson.stringify({ error: error.message }), { status: 400 });
  }
}