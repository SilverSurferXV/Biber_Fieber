import { schema, OutputType } from "./status_POST.schema";
import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
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
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const paymentIntent = await stripe.paymentIntents.retrieve(input.paymentIntentId);

    if (paymentIntent.metadata.userId !== user.id.toString()) {
      throw new Error("Unauthorized access to this payment intent.");
    }

    if (paymentIntent.amount !== input.amount * 100) {
      throw new Error("Amount mismatch between intent and request.");
    }

    let credited = false;
    let pointsCredited: number | null = null;

    if (paymentIntent.status === "succeeded") {
      try {
        const result = await creditWalletTopup({
          customerId: user.id,
          amount: input.amount,
          paymentIntentId: input.paymentIntentId,
          paymentMethod: input.paymentMethod,
        });
        credited = true;
        pointsCredited = result.pointsCredited;
      } catch (e: any) {
        if (e.message === "Payment already processed.") {
          credited = true;
          pointsCredited = null;
        } else {
          throw e;
        }
      }
    }

    return new Response(
      superjson.stringify({
        status: paymentIntent.status,
        credited,
        pointsCredited,
      } satisfies OutputType)
    );
  } catch (error: any) {
    console.error("Error in redirect-payment/status_POST:", error);
    const status = error.name === "NotAuthenticatedError" ? 401 : 400;
    return new Response(superjson.stringify({ error: error.message }), { status });
  }
}