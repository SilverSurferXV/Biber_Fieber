import { schema, OutputType, TopupHandoffStatus } from "./info_GET.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getBonusTiers } from "../../../helpers/creditWalletTopup";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const tokenStr = url.searchParams.get("token");
    if (!tokenStr) {
      throw new Error("Missing token query parameter");
    }

    const input = schema.parse({ token: tokenStr });

    const row = await db.selectFrom("topupHandoffTokens")
      .innerJoin("users", "users.id", "topupHandoffTokens.customerId")
      .select([
        "topupHandoffTokens.id",
        "topupHandoffTokens.amount",
        "topupHandoffTokens.status",
        "topupHandoffTokens.expiresAt",
        "topupHandoffTokens.pointsCredited",
        "users.firstName",
        "users.displayName"
      ])
      .where("topupHandoffTokens.token", "=", input.token)
      .executeTakeFirst();

    if (!row) {
      throw new Error("Token not found");
    }

    const now = new Date();
    let currentStatus = row.status as TopupHandoffStatus;

    if (currentStatus === "pending" && new Date(row.expiresAt) < now) {
      await db.updateTable("topupHandoffTokens")
        .set({ status: "expired" })
        .where("id", "=", row.id)
        .execute();
      currentStatus = "expired";
    }

    const amountNum = Number(row.amount);
    const bonusTiers = await getBonusTiers();
    const matchedTier = bonusTiers.find((t) => t.amount === amountNum);
    const bonusPercent = matchedTier ? matchedTier.bonusPercent : 0;
    const pointsToCredit = amountNum * (1 + bonusPercent / 100);

    const firstName = row.firstName || row.displayName;

    return new Response(
      superjson.stringify({
        status: currentStatus,
        amount: amountNum,
        bonusPercent,
        pointsToCredit,
        pointsCredited: row.pointsCredited ? Number(row.pointsCredited) : null,
        firstName,
        expiresAt: new Date(row.expiresAt),
      } satisfies OutputType)
    );
  } catch (error: any) {
    console.error("handoff info error:", error);
    return new Response(superjson.stringify({ error: error.message }), { status: 400 });
  }
}