import { schema, OutputType } from "./status_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    // Ensure the user is an admin
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
      const updateResult = await trx
        .updateTable("orders")
        .set({ status: result.status })
        .where("id", "=", result.orderId)
        .executeTakeFirst();

      if (Number(updateResult.numUpdatedRows) === 0) {
        throw new Error("ORDER_NOT_FOUND");
      }

      // When an order is delivered, credit the referral bonus
      if (result.status === "delivered") {
        const order = await trx
          .selectFrom("orders")
          .select(["customerId", "subtotal", "orderNumber", "bibercodePointsCredited"])
          .where("id", "=", result.orderId)
          .executeTakeFirst();

        if (!order || !order.customerId) {
          console.log(`Order ${result.orderId} has no customer, skipping bonus.`);
          return;
        }

        // Avoid double crediting
        const alreadyCredited = Number(order.bibercodePointsCredited || 0);
        if (alreadyCredited > 0) {
          console.log(`Order ${result.orderId} already has points credited (${alreadyCredited}), skipping.`);
          return;
        }

        const customer = await trx
          .selectFrom("users")
          .select(["referredByBibercode", "charityOrganizationId"])
          .where("id", "=", order.customerId)
          .executeTakeFirst();

        if (!customer) {
          return;
        }

        // Calculate net subtotal from order items (unit price * quantity, no tax)
        const orderItems = await trx
          .selectFrom("orderItems")
          .select(["unitPrice", "quantity"])
          .where("orderId", "=", result.orderId)
          .execute();

        const netSubtotal = orderItems.reduce((sum, item) => {
          return sum + Number(item.unitPrice) * Number(item.quantity);
        }, 0);

        // Check if bibercode referral bonus applies
        if (customer.referredByBibercode) {
          const referrer = await trx
            .selectFrom("users")
            .select(["id", "pointsBalance"])
            .where("bibercode", "=", customer.referredByBibercode)
            .executeTakeFirst();

          if (referrer) {
            const bonus = netSubtotal * 0.05;

            console.log(`Crediting Bibercode bonus of ${bonus} (net subtotal: ${netSubtotal}) to referrer ${referrer.id} for order ${order.orderNumber}`);

            await trx
              .updateTable("users")
              .set({ pointsBalance: (Number(referrer.pointsBalance || 0) + bonus).toString() })
              .where("id", "=", referrer.id)
              .execute();

            await trx
              .updateTable("orders")
              .set({ bibercodePointsCredited: bonus.toString() })
              .where("id", "=", result.orderId)
              .execute();

            await trx
              .insertInto("pointTransactions")
              .values({
                amount: bonus.toString(),
                customerId: referrer.id,
                type: "bibercode_credit",
                note: `Bonus for referred order ${order.orderNumber}`,
                referenceId: order.orderNumber,
              })
              .execute();

            return;
          }
        }

        // If no bibercode referrer, check if customer has a charity organization
        if (customer.charityOrganizationId) {
          const charity = await trx
            .selectFrom("charityOrganizations")
            .select(["id", "name", "totalPointsEarned"])
            .where("id", "=", customer.charityOrganizationId)
            .executeTakeFirst();

          if (charity) {
            const bonus = netSubtotal * 0.05;

            console.log(`Crediting charity donation of ${bonus} to organization ${charity.name} for order ${order.orderNumber}`);

            await trx
              .updateTable("charityOrganizations")
              .set({
                totalPointsEarned: (Number(charity.totalPointsEarned || 0) + bonus).toString(),
              })
              .where("id", "=", charity.id)
              .execute();

            await trx
              .updateTable("orders")
              .set({ bibercodePointsCredited: bonus.toString() })
              .where("id", "=", result.orderId)
              .execute();
          }
        }
      }
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