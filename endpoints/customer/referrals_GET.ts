import { schema, OutputType } from "./referrals_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    // Validate empty input to ensure adherence to schema
    schema.parse({});

    if (!user.bibercode) {
      return new Response(superjson.stringify({ referrals: [] } satisfies OutputType));
    }

    // Join users with their orders and the point transactions those orders generated for the referrer
    const friends = await db
      .selectFrom("users")
      .where("referredByBibercode", "=", user.bibercode)
      .leftJoin("orders", "orders.customerId", "users.id")
      .leftJoin("pointTransactions", (join) =>
        join
          .on("pointTransactions.type", "=", "bibercode_credit")
          .on("pointTransactions.customerId", "=", user.id)
                    .onRef("pointTransactions.referenceId", "=", "orders.orderNumber")
      )
      .select([
        "users.id",
        "users.firstName",
        "users.lastName",
        "users.streetAddress",
        "users.city",
        "users.postcode",
        "users.createdAt",
        db.fn.sum<string | number | null>("pointTransactions.amount").as("totalPointsEarned"),
      ])
      .groupBy("users.id")
      .orderBy("users.createdAt", "desc")
      .execute();

    const output: OutputType = {
      referrals: friends.map((f) => ({
        id: f.id,
        firstName: f.firstName,
        lastName: f.lastName,
        streetAddress: f.streetAddress,
        city: f.city,
        postcode: f.postcode,
        createdAt: f.createdAt,
        totalPointsEarned: f.totalPointsEarned ? Number(f.totalPointsEarned) : 0,
      })),
    };

    return new Response(superjson.stringify(output satisfies OutputType));
  } catch (error: any) {
    const status = error.name === "NotAuthenticatedError" ? 401 : 400;
    return new Response(superjson.stringify({ error: error.message }), { status });
  }
}