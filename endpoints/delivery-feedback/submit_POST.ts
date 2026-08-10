import { schema, OutputType } from "./submit_POST.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "user") {
      return new Response(superjson.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    await db.transaction().execute(async (trx) => {
      // 1. Verify order
      const order = await trx
        .selectFrom("orders")
        .select(["id", "orderNumber", "deliveryDriverId"])
        .where("id", "=", input.orderId)
        .where("customerId", "=", user.id)
        .where("status", "=", "delivered")
        .where("deliveryDriverId", "is not", null)
        .executeTakeFirst();

      if (!order || !order.deliveryDriverId) {
        throw new Error("Order not found, not delivered, or missing a delivery driver.");
      }

      // 2. Check if already rated
      const existingRating = await trx
        .selectFrom("driverDeliveryRatings")
        .select("id")
        .where("orderId", "=", order.id)
        .where("customerId", "=", user.id)
        .executeTakeFirst();

      if (existingRating) {
        throw new Error("Feedback already submitted for this order.");
      }

      // 3. Insert rating
      await trx
        .insertInto("driverDeliveryRatings")
        .values({
          orderId: order.id,
          customerId: user.id,
          driverId: order.deliveryDriverId,
          cleanRating: input.cleanRating,
          noiseRating: input.noiseRating,
          placementRating: input.placementRating,
        })
        .execute();

      // 4. Handle tip logic if applicable
      const tipAmount = input.tipAmount ?? 0;
      if (tipAmount > 0) {
        // Fetch current user balance safely
        const customer = await trx
          .selectFrom("users")
          .select(["pointsBalance"])
          .where("id", "=", user.id)
          .executeTakeFirstOrThrow();
          
        const currentBalance = customer.pointsBalance != null ? Number(customer.pointsBalance) : 0;
        
        if (currentBalance < tipAmount) {
          throw new Error("Nicht genügend Punkte für dieses Trinkgeld.");
        }

        // Deduct from customer
        await trx
          .updateTable("users")
          .set({ pointsBalance: (currentBalance - tipAmount).toString() })
          .where("id", "=", user.id)
          .execute();

        // Fetch driver's current balance then add tip
        const driver = await trx
          .selectFrom("users")
          .select(["pointsBalance"])
          .where("id", "=", order.deliveryDriverId)
          .executeTakeFirstOrThrow();

        const driverBalance = driver.pointsBalance != null ? Number(driver.pointsBalance) : 0;

        // Add to driver
        await trx
          .updateTable("users")
          .set({ pointsBalance: (driverBalance + tipAmount).toString() })
          .where("id", "=", order.deliveryDriverId)
          .execute();

        // Log the tip
        await trx
          .insertInto("driverTips")
          .values({
            orderId: order.id,
            customerId: user.id,
            driverId: order.deliveryDriverId,
            amount: tipAmount,
          })
          .execute();

        // Customer point transaction
        await trx
          .insertInto("pointTransactions")
          .values({
            customerId: user.id,
            amount: -tipAmount,
            type: "order_payment",
            referenceId: String(order.id),
            note: `Trinkgeld für Bestellung ${order.orderNumber}`,
          })
          .execute();

        // Driver point transaction
        await trx
          .insertInto("pointTransactions")
          .values({
            customerId: order.deliveryDriverId,
            amount: tipAmount,
            type: "topup",
            referenceId: String(order.id),
            note: `Trinkgeld von Kunde für Bestellung ${order.orderNumber}`,
          })
          .execute();
      }
    });

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Forbidden") ? 403 : 400;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}