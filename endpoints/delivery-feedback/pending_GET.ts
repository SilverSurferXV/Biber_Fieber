import { schema, OutputType } from "./pending_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

            if (user.role !== "user") {
      return new Response(superjson.stringify({ error: "Forbidden" }), { status: 403 });
    }

    // Find orders that are delivered, have a driver, and lack a rating from this customer
    const pendingOrders = await db
      .selectFrom("orders")
      .leftJoin("users as driver", "orders.deliveryDriverId", "driver.id")
      .select([
        "orders.id as orderId",
        "orders.orderNumber",
        "orders.deliveryDate",
        "driver.firstName as driverFirstName",
        "driver.lastName as driverLastName"
      ])
      .where("orders.customerId", "=", user.id)
      .where("orders.status", "=", "delivered")
      .where("orders.deliveryDriverId", "is not", null)
      .where((eb) =>
        eb.not(
          eb.exists(
            eb.selectFrom("driverDeliveryRatings")
              .select("driverDeliveryRatings.id")
              .whereRef("driverDeliveryRatings.orderId", "=", "orders.id")
              .where("driverDeliveryRatings.customerId", "=", user.id)
          )
        )
      )
      .orderBy("orders.deliveryDate", "desc")
      .limit(5)
      .execute();

    const result: OutputType = pendingOrders.map((row) => ({
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      driverFirstName: row.driverFirstName ?? null,
      driverLastName: row.driverLastName ?? null,
      // Handle timestamp casting just in case Kysely returns a Date object
      deliveryDate: row.deliveryDate
        ? (row.deliveryDate instanceof Date ? row.deliveryDate.toISOString() : String(row.deliveryDate))
        : null,
    }));

    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}