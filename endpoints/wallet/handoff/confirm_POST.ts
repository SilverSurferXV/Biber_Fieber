import { schema, OutputType } from "./confirm_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { creditWalletTopup } from "../../../helpers/creditWalletTopup";
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

    if (row.status === "completed") {
      return new Response(
        superjson.stringify({
          success: true,
          pointsCredited: Number(row.pointsCredited),
        } satisfies OutputType)
      );
    }

    if (row.status !== "pending") {
      throw new Error(`Token is not pending. Status: ${row.status}`);
    }

    const now = new Date();
    if (new Date(row.expiresAt) < now) {
      await db.updateTable("topupHandoffTokens")
        .set({ status: "expired" })
        .where("id", "=", row.id)
        .execute();
      throw new Error("Token expired");
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(input.paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      throw new Error(`Payment is not successful. Current status: ${paymentIntent.status}`);
    }

    const amountNum = Number(row.amount);
    if (paymentIntent.amount !== amountNum * 100) {
      throw new Error("Amount mismatch between intent and token row.");
    }

    if (paymentIntent.metadata.handoffToken !== input.token) {
      throw new Error("Payment intent metadata handoffToken mismatch.");
    }

    const { pointsCredited } = await creditWalletTopup({
      customerId: row.customerId,
      amount: amountNum,
      paymentIntentId: input.paymentIntentId,
      paymentMethod: input.paymentMethod,
    });

    await db.updateTable("topupHandoffTokens")
      .set({
        status: "completed",
        completedAt: new Date(),
        pointsCredited: pointsCredited.toString(),
        paymentIntentId: input.paymentIntentId,
      })
      .where("id", "=", row.id)
      .execute();

    return new Response(
      superjson.stringify({
        success: true,
        pointsCredited,
      } satisfies OutputType)
    );
  } catch (error: any) {
    console.error("handoff confirm error:", error);
    return new Response(superjson.stringify({ error: error.message }), { status: 400 });
  }
}