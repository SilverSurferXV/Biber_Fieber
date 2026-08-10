import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    // Verify admin session
    if (user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized. Admin access required." }),
        { status: 403 }
      );
    }

    const text = await request.text();
    const json = superjson.parse(text);
    const result = schema.parse(json);

    await db.transaction().execute(async (trx) => {
      // Fetch the order
      const order = await trx
        .selectFrom("orders")
        .select(["id", "orderNumber", "customerId", "pointsUsed", "pointsEarned"])
        .where("id", "=", result.orderId)
        .executeTakeFirst();

      if (!order) {
        throw new Error("ORDER_NOT_FOUND");
      }

      // Handle points refund if order belongs to a customer
      if (order.customerId) {
        const customer = await trx
          .selectFrom("users")
          .select("pointsBalance")
          .where("id", "=", order.customerId)
          .executeTakeFirst();

        if (customer) {
          let currentBalance = Number(customer.pointsBalance || 0);
          let balanceChanged = false;

          // Add pointsUsed back
          if (order.pointsUsed && Number(order.pointsUsed) > 0) {
            currentBalance += Number(order.pointsUsed);
            balanceChanged = true;
          }

          // Subtract pointsEarned (don't go below 0)
          if (order.pointsEarned && Number(order.pointsEarned) > 0) {
            currentBalance = Math.max(0, currentBalance - Number(order.pointsEarned));
            balanceChanged = true;
          }

          if (balanceChanged) {
            await trx
              .updateTable("users")
              .set({ pointsBalance: currentBalance.toString() })
              .where("id", "=", order.customerId)
              .execute();
          }
        }
      }

      // Delete point transactions where referenceId matches the order id (as string) OR orderNumber
      // AND type is NOT 'bibercode_credit'
      await trx
        .deleteFrom("pointTransactions")
        .where((eb) =>
          eb.and([
            eb.or([
              eb("referenceId", "=", String(order.id)),
              eb("referenceId", "=", order.orderNumber),
            ]),
            eb("type", "!=", "bibercode_credit"),
          ])
        )
        .execute();

      // Delete orderItems
      await trx
        .deleteFrom("orderItems")
        .where("orderId", "=", result.orderId)
        .execute();

      // Delete the order itself
      await trx
        .deleteFrom("orders")
        .where("id", "=", result.orderId)
        .execute();
    });

    return new Response(
      superjson.stringify({ success: true } satisfies OutputType)
    );
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
      return new Response(
        superjson.stringify({ error: "Order not found" }),
        { status: 404 }
      );
    }
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}