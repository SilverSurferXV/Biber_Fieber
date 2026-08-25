import { schema, OutputType } from "./create-payment-intent_POST.schema";
import superjson from "superjson";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { profileCompleteness } from "../../helpers/profileCompleteness";
import { isAdult } from "../../helpers/isAdult";
import { db } from "../../helpers/db";
import { Stripe } from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    const profile = await db.selectFrom("users")
      .select(["postcode", "city", "streetAddress", "mobileNumber", "dateOfBirth"])
      .where("id", "=", user.id)
      .executeTakeFirstOrThrow();

    const { isComplete, missingFields } = profileCompleteness(profile);
    if (!isComplete) {
      console.error("Profile incomplete for wallet top-up. Missing fields:", missingFields);
      throw new Error("Bitte vervollständige zuerst deine Daten (PLZ, Stadt, Straße & Hausnummer, Handynummer, Geburtsdatum), um Guthaben aufzuladen.");
    }

    if (!isAdult(profile.dateOfBirth)) {
      throw new Error("Du musst mindestens 18 Jahre alt sein, um bei uns zu bestellen.");
    }

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
      // For backward compatibility, we keep payment_method_types as is, but we add metadata
       payment_method_types: paymentMethodTypes,
       metadata: {
         userId: user.id.toString(),
         amount: input.amount.toString(),
        acceptsWallets: paymentMethodTypes.includes("card") ? "true" : "false",
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