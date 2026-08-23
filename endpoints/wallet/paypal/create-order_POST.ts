import { schema, OutputType } from "./create-order_POST.schema";
import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { profileCompleteness } from "../../../helpers/profileCompleteness";
import { isAdult } from "../../../helpers/isAdult";
import { db } from "../../../helpers/db";
import { getPaypalAccessToken, getPaypalBaseUrl } from "../../../helpers/paypalApi";

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

    const accessToken = await getPaypalAccessToken();
    const baseUrl = getPaypalBaseUrl();

    const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "EUR",
              value: input.amount.toFixed(2),
            },
          },
        ],
      }),
    });

    if (!orderResponse.ok) {
      const errText = await orderResponse.text();
      console.error("PayPal Create Order Error:", errText);
      throw new Error("Failed to create PayPal order");
    }

    const orderData = await orderResponse.json();

    return new Response(
      superjson.stringify({
        orderId: orderData.id,
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