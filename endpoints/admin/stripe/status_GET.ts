import superjson from "superjson";
import Stripe from "stripe";
import { OutputType } from "./status_GET.schema";
import { getServerUserSession } from "../../../helpers/getServerUserSession";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    if (user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    await stripe.balance.retrieve();

    return new Response(
      superjson.stringify({ connected: true } satisfies OutputType)
    );
  } catch (error: any) {
    if (error.name === "NotAuthenticatedError") {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    return new Response(
      superjson.stringify({ connected: false, error: error.message } satisfies OutputType)
    );
  }
}