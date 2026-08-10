import { schema, OutputType } from "./point-adjustment_POST.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") throw new Error("Forbidden");
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    await db.transaction().execute(async (trx) => {
      const dbUser = await trx.selectFrom("users").select("pointsBalance").where("id", "=", input.customerId).executeTakeFirstOrThrow();
      
      await trx
        .updateTable("users")
        .set({ pointsBalance: (Number(dbUser.pointsBalance || 0) + input.amount).toString() })
        .where("id", "=", input.customerId)
        .execute();

      await trx
        .insertInto("pointTransactions")
        .values({
          amount: input.amount.toString(),
          customerId: input.customerId,
          type: "admin_adjustment",
          note: input.note,
        })
        .execute();
    });

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: error.message === "Forbidden" ? 403 : 400 });
  }
}