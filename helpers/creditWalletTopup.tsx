import { db } from "./db";
import { PaymentMethodType } from "./schema";

const DEFAULT_BONUS_TIERS: { amount: number; bonusPercent: number }[] = [
  { amount: 15, bonusPercent: 0 },
  { amount: 25, bonusPercent: 5 },
  { amount: 50, bonusPercent: 7 },
  { amount: 100, bonusPercent: 10 },
  { amount: 200, bonusPercent: 11 },
  { amount: 500, bonusPercent: 12 },
];

export async function getBonusTiers(): Promise<{ amount: number; bonusPercent: number }[]> {
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

export async function creditWalletTopup({
  customerId,
  amount,
  paymentIntentId,
  paymentMethod
}: {
  customerId: number;
  amount: number;
  paymentIntentId: string;
  paymentMethod: string;
}): Promise<{ pointsCredited: number; bonusPercent: number }> {
  try {
    // Safety check: Verify this payment intent hasn't been processed yet to prevent double-crediting
    const existingTransaction = await db
      .selectFrom("pointTransactions")
      .select("id")
      .where("note", "like", `%${paymentIntentId}%`)
      .executeTakeFirst();

    if (existingTransaction) {
      throw new Error("Payment already processed.");
    }

    // Fetch bonus tiers from DB, with fallback to defaults
    const bonusTiers = await getBonusTiers();
    const matchedTier = bonusTiers.find((t) => t.amount === amount);

    if (!matchedTier) {
      throw new Error(`No bonus tier configured for amount: ${amount}`);
    }

    const bonusPct = matchedTier.bonusPercent;
    const pointsToCredit = amount * (1 + bonusPct / 100);

    // Ensure we match the exact db enum if user picked klarna_sofort
    const dbPaymentMethod: PaymentMethodType =
      paymentMethod === "klarna_sofort"
        ? "klarna"
        : (paymentMethod as PaymentMethodType);

    await db.transaction().execute(async (trx) => {
      // Re-fetch user to get freshest balance within transaction locking context
      const dbUser = await trx
        .selectFrom("users")
        .select("pointsBalance")
        .where("id", "=", customerId)
        .executeTakeFirstOrThrow();

      const topup = await trx
        .insertInto("walletTopups")
        .values({
          customerId,
          amount: amount.toString(),
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
        .where("id", "=", customerId)
        .execute();

      await trx
        .insertInto("pointTransactions")
        .values({
          amount: pointsToCredit.toString(),
          customerId,
          type: "topup",
          note: `Wallet top-up with ${bonusPct}% bonus (Stripe: ${paymentIntentId})`,
          referenceId: topup.id.toString(),
        })
        .execute();
    });

    return { pointsCredited: pointsToCredit, bonusPercent: bonusPct };
  } catch (error) {
    console.error("creditWalletTopup failed:", error);
    throw error;
  }
}