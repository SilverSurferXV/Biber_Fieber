import { schema, OutputType } from "./topup_POST.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

const bonusMap = {
  15: 0,
  25: 5,
  50: 7,
    100: 10,
  200: 11,
  500: 12,
};

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const bonusPct = bonusMap[input.amount as keyof typeof bonusMap];
    const pointsToCredit = input.amount * (1 + bonusPct / 100);

    await db.transaction().execute(async (trx) => {
      const dbUser = await trx.selectFrom("users").select("pointsBalance").where("id", "=", user.id).executeTakeFirstOrThrow();
      
      const topup = await trx
        .insertInto("walletTopups")
        .values({
          customerId: user.id,
          amount: input.amount.toString(),
          bonusPercent: bonusPct.toString(),
          pointsCredited: pointsToCredit.toString(),
          paymentMethod: input.paymentMethod,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      await trx
        .updateTable("users")
        .set({ pointsBalance: (Number(dbUser.pointsBalance || 0) + pointsToCredit).toString() })
        .where("id", "=", user.id)
        .execute();

      await trx
        .insertInto("pointTransactions")
        .values({
          amount: pointsToCredit.toString(),
          customerId: user.id,
          type: "topup",
          note: `Wallet top-up with ${bonusPct}% bonus`,
          referenceId: topup.id.toString(),
        })
        .execute();
    });

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: error.name === "NotAuthenticatedError" ? 401 : 400 });
  }
}