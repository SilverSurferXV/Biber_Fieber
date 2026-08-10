import { schema, OutputType } from "./confirm-topup_POST.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import Stripe from "stripe";
import { PaymentMethodType } from "../../helpers/schema";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// Fallback bonus tiers for backward compatibility if none are configured in DB
const DEFAULT_BONUS_TIERS: { amount: number; bonusPercent: number }[] = [
  { amount: 15, bonusPercent: 0 },
  { amount: 25, bonusPercent: 5 },
  { amount: 50, bonusPercent: 7 },
  { amount: 100, bonusPercent: 10 },
  { amount: 200, bonusPercent: 11 },
  { amount: 500, bonusPercent: 12 },
];

async function getBonusTiers(): Promise<{ amount: number; bonusPercent: number }[]> {
  const settings = await db
    .selectFrom("appSettings")
    .select("bonusTiers")
    .limit(1)
    .executeTakeFirst();

  if (!settings?.bonusTiers) {
    console.log("No bonus tiers found in DB, using default fallback tiers.");
    return DEFAULT_BONUS_TIERS;
  }

  try {
    const parsed = settings.bonusTiers as unknown;
    if (!Array.isArray(parsed)) {
      console.warn("bonusTiers in DB is not an array, falling back to defaults.", parsed);
      return DEFAULT_BONUS_TIERS;
    }

    const tiers = (parsed as { amount: unknown; bonusPercent: unknown }[])
      .filter(
        (t) =>
          typeof t.amount === "number" && typeof t.bonusPercent === "number"
      )
      .map((t) => ({
        amount: t.amount as number,
        bonusPercent: t.bonusPercent as number,
      }));

    if (tiers.length === 0) {
      console.warn("bonusTiers in DB parsed to empty array, falling back to defaults.");
      return DEFAULT_BONUS_TIERS;
    }

    return tiers;
  } catch (error) {
    console.error("Failed to parse bonusTiers from DB, falling back to defaults:", error);
    return DEFAULT_BONUS_TIERS;
  }
}

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

    // Safety check: Verify this payment intent hasn't been processed yet to prevent double-crediting
    const existingTransaction = await db
      .selectFrom("pointTransactions")
      .select("id")
      .where("note", "like", `%${input.paymentIntentId}%`)
      .executeTakeFirst();

    if (existingTransaction) {
      throw new Error("Payment already processed.");
    }

    // Fetch bonus tiers from DB, with fallback to defaults
    const bonusTiers = await getBonusTiers();
    const matchedTier = bonusTiers.find((t) => t.amount === input.amount);

    if (!matchedTier) {
      throw new Error(`No bonus tier configured for amount: ${input.amount}`);
    }

    const bonusPct = matchedTier.bonusPercent;
    const pointsToCredit = input.amount * (1 + bonusPct / 100);

    // Ensure we match the exact db enum if user picked klarna_sofort
    const dbPaymentMethod: PaymentMethodType =
      input.paymentMethod === "klarna_sofort"
        ? "klarna"
        : (input.paymentMethod as PaymentMethodType);

    await db.transaction().execute(async (trx) => {
      // Re-fetch user to get freshest balance within transaction locking context
      const dbUser = await trx
        .selectFrom("users")
        .select("pointsBalance")
        .where("id", "=", user.id)
        .executeTakeFirstOrThrow();

      const topup = await trx
        .insertInto("walletTopups")
        .values({
          customerId: user.id,
          amount: input.amount.toString(),
          bonusPercent: bonusPct.toString(),
          pointsCredited: pointsToCredit.toString(),
          paymentMethod: dbPaymentMethod,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      await trx
        .updateTable("users")
        .set({
          pointsBalance: (
            Number(dbUser.pointsBalance || 0) + pointsToCredit
          ).toString(),
        })
        .where("id", "=", user.id)
        .execute();

      await trx
        .insertInto("pointTransactions")
        .values({
          amount: pointsToCredit.toString(),
          customerId: user.id,
          type: "topup",
          note: `Wallet top-up with ${bonusPct}% bonus (Stripe: ${input.paymentIntentId})`,
          referenceId: topup.id.toString(),
        })
        .execute();
    });

    return new Response(
      superjson.stringify({
        success: true,
        pointsCredited: pointsToCredit,
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