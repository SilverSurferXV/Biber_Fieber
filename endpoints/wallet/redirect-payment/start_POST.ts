import { schema, OutputType } from "./start_POST.schema";
import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { profileCompleteness } from "../../../helpers/profileCompleteness";
import { isAdult } from "../../../helpers/isAdult";
import { db } from "../../../helpers/db";
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
      .select([
        "email", 
        "firstName", 
        "lastName", 
        "streetAddress", 
        "city", 
        "postcode", 
        "mobileNumber", 
        "dateOfBirth"
      ])
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

    let paymentMethodTypes: string[] = ["klarna"];
    if (input.paymentMethod === "amazon_pay") {
      paymentMethodTypes = ["amazon_pay"];
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: input.amount * 100, // EUR in cents
      currency: "eur",
      payment_method_types: paymentMethodTypes,
      metadata: {
        userId: user.id.toString(),
        amount: input.amount.toString(),
        paymentMethod: input.paymentMethod,
        flow: "native_redirect"
      },
    });

    const returnUrl = `https://biberfieber.floot.app/zahlung-abgeschlossen?payment_intent=${paymentIntent.id}`;
    let paymentMethodData: Stripe.PaymentIntentConfirmParams.PaymentMethodData;

    if (input.paymentMethod === "amazon_pay") {
      paymentMethodData = { type: "amazon_pay" };
    } else {
      const name = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
      paymentMethodData = {
        type: "klarna",
        billing_details: {
          email: profile.email,
          name: name || user.displayName,
          address: {
            country: "DE",
            line1: profile.streetAddress || "",
            city: profile.city || "",
            postal_code: profile.postcode || ""
          }
        }
      };
    }

    const confirmedPaymentIntent = await stripe.paymentIntents.confirm(
      paymentIntent.id,
      {
        payment_method_data: paymentMethodData,
        return_url: returnUrl,
      }
    );

    const redirectUrl = confirmedPaymentIntent.next_action?.redirect_to_url?.url;
    if (!redirectUrl) {
      console.error("Missing redirect URL in confirmed PaymentIntent:", confirmedPaymentIntent);
      throw new Error("Failed to get redirect URL from Stripe.");
    }

    return new Response(
      superjson.stringify({
        paymentIntentId: confirmedPaymentIntent.id,
        redirectUrl: redirectUrl,
        status: confirmedPaymentIntent.status,
      } satisfies OutputType)
    );
  } catch (error: any) {
    console.error("Error in redirect-payment/start_POST:", error);
    return new Response(superjson.stringify({ error: error.message }), { 
      status: error.name === "NotAuthenticatedError" ? 401 : 400 
    });
  }
}