import { schema, OutputType } from "./create-payment-intent_POST.schema";
import superjson from "superjson";
import { getServerUserSession } from "../../helpers/getServerUserSession";
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

    let paymentMethodTypes: string[] = ["card"];
    if (input.paymentMethod === "klarna" || input.paymentMethod === "klarna_sofort") {
      paymentMethodTypes = ["klarna"];
    } else if (input.paymentMethod === "paypal") {
      paymentMethodTypes = ["paypal"];
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: input.amount * 100, // Stripe expects amounts in cents for EUR
      currency: "eur",
      payment_method_types: paymentMethodTypes,
      metadata: {
        userId: user.id.toString(),
        amount: input.amount.toString(),
        paymentMethod: input.paymentMethod,
      },
    });

    if (!paymentIntent.client_secret) {
      throw new Error("Failed to create payment intent: Missing client_secret");
    }

    return new Response(
      superjson.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      } satisfies OutputType)
    );

  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { 
      status: error.name === "NotAuthenticatedError" ? 401 : 400 
    });
  }
}