 import { schema, OutputType } from "./confirm-topup_POST.schema";
 import superjson from "superjson";
 import { getServerUserSession } from "../../helpers/getServerUserSession";
import { creditWalletTopup } from "../../helpers/creditWalletTopup";
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

    // Verify the payment intent directly from Stripe's API
    const paymentIntent = await stripe.paymentIntents.retrieve(input.paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      throw new Error(`Payment is not successful. Current status: ${paymentIntent.status}`);
    }

    if (paymentIntent.amount !== input.amount * 100) {
       throw new Error("Amount mismatch between intent and request.");
     }
 
    const { pointsCredited } = await creditWalletTopup({
      customerId: user.id,
      amount: input.amount,
      paymentIntentId: input.paymentIntentId,
      paymentMethod: input.paymentMethod,
    });
 
     return new Response(
       superjson.stringify({
        success: true,
                pointsCredited,
      } satisfies OutputType)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      error instanceof Error && error.name === "NotAuthenticatedError"
        ? 401
         : 400;
     return new Response(superjson.stringify({ error: message }), { status });
   }
}