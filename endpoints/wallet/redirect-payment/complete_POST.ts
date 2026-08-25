import { schema, OutputType } from "./complete_POST.schema";
import superjson from "superjson";
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

    const paymentIntent = await stripe.paymentIntents.retrieve(input.paymentIntentId);

    if (!paymentIntent.metadata || !paymentIntent.metadata.userId) {
      throw new Error("No user metadata attached to this payment intent.");
    }

    const userId = Number(paymentIntent.metadata.userId);
    const paymentMethod = paymentIntent.metadata.paymentMethod ?? "credit_card";
    const amount = paymentIntent.amount / 100;

    let credited = false;
    let alreadyCredited = false;
    let pointsCredited: number | null = null;

    if (paymentIntent.status === "succeeded") {
      try {
        const result = await creditWalletTopup({
          customerId: userId,
          amount,
          paymentIntentId: input.paymentIntentId,
          paymentMethod,
        });
        credited = true;
        pointsCredited = result.pointsCredited;
      } catch (e: any) {
        if (e.message === "Payment already processed.") {
          alreadyCredited = true;
          pointsCredited = null;
        } else {
          console.error("Error crediting redirect payment complete:", e);
          throw e;
        }
      }
    }

    return new Response(
      superjson.stringify({
        status: paymentIntent.status,
        credited,
        alreadyCredited,
        pointsCredited,
      } satisfies OutputType)
    );
  } catch (error: any) {
    console.error("Error in redirect-payment/complete_POST:", error);
    return new Response(superjson.stringify({ error: error.message }), { status: 400 });
  }
}