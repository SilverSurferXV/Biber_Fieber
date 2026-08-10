import { schema, OutputType } from "./capture-order_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { getPaypalAccessToken, getPaypalBaseUrl } from "../../../helpers/paypalApi";

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
    return DEFAULT_BONUS_TIERS;
  }

  try {
    const parsed = settings.bonusTiers as unknown;
    if (!Array.isArray(parsed)) {
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
      return DEFAULT_BONUS_TIERS;
    }

    return tiers;
  } catch (error) {
    return DEFAULT_BONUS_TIERS;
  }
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const accessToken = await getPaypalAccessToken();
    const baseUrl = getPaypalBaseUrl();

    const captureResponse = await fetch(`${baseUrl}/v2/checkout/orders/${input.orderId}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!captureResponse.ok) {
      const errText = await captureResponse.text();
      console.error("PayPal Capture Order Error:", errText);
      throw new Error("Failed to capture PayPal order");
    }

    const captureData = await captureResponse.json();

    if (captureData.status !== "COMPLETED") {
      throw new Error(`PayPal order is not completed. Status: ${captureData.status}`);
    }

    const existingTransaction = await db
      .selectFrom("pointTransactions")
      .select("id")
      .where("note", "like", `%${input.orderId}%`)
      .executeTakeFirst();

    if (existingTransaction) {
      throw new Error("Payment already processed.");
    }

    const bonusTiers = await getBonusTiers();
    const matchedTier = bonusTiers.find((t) => t.amount === input.amount);

    if (!matchedTier) {
      throw new Error(`No bonus tier configured for amount: ${input.amount}`);
    }

    const bonusPct = matchedTier.bonusPercent;
    const pointsToCredit = input.amount * (1 + bonusPct / 100);

    await db.transaction().execute(async (trx) => {
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
          paymentMethod: "paypal",
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
          note: `Wallet top-up with ${bonusPct}% bonus (PayPal: ${input.orderId})`,
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