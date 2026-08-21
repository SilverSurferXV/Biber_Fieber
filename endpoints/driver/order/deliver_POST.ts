import { schema, OutputType } from "./deliver_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { getEffectiveDeliveryDay } from "../../../helpers/getEffectiveDeliveryDay";
import { ONESIGNAL_APP_ID } from "../../../helpers/_publicConfigs";
import { sendMailjetEmail } from "../../../helpers/sendMailjetEmail";
import { replaceTemplateVars } from "../../../helpers/replaceTemplateVars";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "driver") {
      return new Response(
        superjson.stringify({ error: "Unauthorized. Driver access required." }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const result = schema.parse(json);

    // Verify order and get essential delivery details
    const orderData = await db
      .selectFrom("orders")
      .innerJoin("users", "orders.customerId", "users.id")
      .where("orders.id", "=", result.orderId)
      .select([
        "users.postcode",
        "orders.deliveryDate",
        "orders.preferredDeliveryDay",
        "orders.status",
      ])
      .executeTakeFirst();

    if (!orderData) {
      return new Response(
        superjson.stringify({ error: "Order not found" }),
        { status: 404 }
      );
    }

    if (orderData.status === "delivered" || orderData.status === "cancelled") {
      return new Response(
        superjson.stringify({
          error: `Cannot deliver order with status: ${orderData.status}`,
        }),
        { status: 400 }
      );
    }

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;

    if (getEffectiveDeliveryDay(orderData) !== todayStr) {
      return new Response(
        superjson.stringify({ error: "Order is not scheduled for today" }),
        { status: 400 }
      );
    }

    if (!orderData.postcode) {
      return new Response(
        superjson.stringify({ error: "Order customer has no postcode" }),
        { status: 400 }
      );
    }

    // Verify the driver is assigned to this postcode today and get packer info
    const assignment = await db
      .selectFrom("zoneDriverAssignments")
      .select(["packer", "driverId", "carType"])
      .where("driverId", "=", user.id)
      .where("dateKey", "=", todayStr)
      .where("postcode", "=", orderData.postcode)
      .executeTakeFirst();

    if (!assignment) {
      return new Response(
        superjson.stringify({
          error: "Order postcode is not assigned to you today",
        }),
        { status: 403 }
      );
    }

    // Determine packerDriverId: if packer is a numeric string, parse it; otherwise null
    const packerDriverId: number | null =
      assignment.packer && /^\d+$/.test(assignment.packer)
        ? parseInt(assignment.packer, 10)
        : null;

    // Capture customerId before transaction for use after
    let customerId: number | null = null;

    // Process delivery and points logic in transaction
    await db.transaction().execute(async (trx) => {
      const updateResult = await trx
        .updateTable("orders")
       .set({
          status: "delivered",
          deliveryDriverId: user.id,
         deliveryCarType: assignment.carType,
          packerDriverId: packerDriverId,
        })
        .where("id", "=", result.orderId)
        .executeTakeFirst();

      if (Number(updateResult.numUpdatedRows) === 0) {
        throw new Error("ORDER_NOT_FOUND");
      }

      // Run Bibercode bonus logic
      const order = await trx
        .selectFrom("orders")
        .select([
          "customerId",
          "subtotal",
          "orderNumber",
          "bibercodePointsCredited",
        ])
        .where("id", "=", result.orderId)
        .executeTakeFirst();

      if (!order || !order.customerId) return;

      customerId = order.customerId;

      const alreadyCredited = Number(order.bibercodePointsCredited || 0);
      if (alreadyCredited > 0) return;

      const customer = await trx
        .selectFrom("users")
        .select(["referredByBibercode"])
        .where("id", "=", order.customerId)
        .executeTakeFirst();

      if (!customer?.referredByBibercode) return;

      const referrer = await trx
        .selectFrom("users")
        .select(["id", "pointsBalance"])
        .where("bibercode", "=", customer.referredByBibercode)
        .executeTakeFirst();

      if (!referrer) return;

      const orderItems = await trx
        .selectFrom("orderItems")
        .select(["unitPrice", "quantity"])
        .where("orderId", "=", result.orderId)
        .execute();

      const netSubtotal = orderItems.reduce((sum, item) => {
        return sum + Number(item.unitPrice) * Number(item.quantity);
      }, 0);

      const bonus = netSubtotal * 0.05;

      await trx
        .updateTable("users")
        .set({
          pointsBalance: (Number(referrer.pointsBalance || 0) + bonus).toString(),
        })
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
    });

    // Send targeted push notification to the customer (non-blocking)
    if (customerId !== null) {
      const oneSignalApiKey = process.env.ONESIGNAL_REST_API_KEY;
      if (!oneSignalApiKey) {
        console.error("ONESIGNAL_REST_API_KEY is not set — skipping push notification");
      } else {
        try {
          console.log(`Sending delivery push notification to customer ${customerId}`);
          const oneSignalResponse = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${oneSignalApiKey}`,
            },
            body: JSON.stringify({
              app_id: ONESIGNAL_APP_ID,
              include_aliases: { external_id: [String(customerId)] },
              target_channel: "push",
              headings: { en: "Deine Bestellung wurde geliefert!" },
              contents: {
                en: "Lieber Kunde, deine Bestellung steht nun am Gewünschten Ablageort. Öffne die App um deinem Fahrer Feedback zu geben.",
              },
            }),
          });

          if (!oneSignalResponse.ok) {
            const errorBody = await oneSignalResponse.text();
            console.error(
              `OneSignal push notification failed (${oneSignalResponse.status}):`,
              errorBody
            );
          } else {
            const oneSignalResult = await oneSignalResponse.json() as { id?: string; errors?: string[] };
            console.log("OneSignal delivery notification sent, id:", oneSignalResult.id);
          }
        } catch (pushError) {
          console.error("Failed to send OneSignal push notification:", pushError);
        }
      }
    }

    // Send delivery confirmation email to the customer (non-blocking)
    if (customerId !== null) {
      try {
        const customerInfo = await db
          .selectFrom("users")
          .select(["email", "firstName", "lastName", "dropoffDescription", "streetAddress", "postcode", "city"])
          .where("id", "=", customerId)
          .executeTakeFirst();

        const orderInfo = await db
          .selectFrom("orders")
          .select(["orderNumber"])
          .where("id", "=", result.orderId)
          .executeTakeFirst();

        if (customerInfo && orderInfo) {
          const template = await db
            .selectFrom("emailTemplates")
            .selectAll()
            .where("slug", "=", "delivery_confirmation")
            .executeTakeFirst();

          const vars: Record<string, string> = {
            firstName: customerInfo.firstName ?? customerInfo.email,
            orderNumber: orderInfo.orderNumber,
            dropoffDescription: customerInfo.dropoffDescription || "Kein Ablageort hinterlegt",
            streetAddress: customerInfo.streetAddress ?? "",
            postcode: customerInfo.postcode ?? "",
            city: customerInfo.city ?? "",
          };

          let subject: string;
          let html: string;

          if (template) {
            subject = replaceTemplateVars(template.subject, vars);
            html = replaceTemplateVars(template.htmlBody, vars);
          } else {
            subject = `Deine Bestellung ${orderInfo.orderNumber} wurde geliefert`;
            html = `
              <p>Hallo ${vars.firstName},</p>
              <p>deine Bestellung <strong>${orderInfo.orderNumber}</strong> wurde erfolgreich geliefert.</p>
              <p>Ablageort: ${vars.dropoffDescription}</p>
              <p>Vielen Dank für deine Bestellung bei Biber Fieber!</p>
            `;
          }

          await sendMailjetEmail({
            to: [{ email: customerInfo.email, name: `${customerInfo.firstName ?? ""} ${customerInfo.lastName ?? ""}`.trim() || customerInfo.email }],
            subject,
            html,
          });

          console.log(`Delivery confirmation email sent to customer ${customerId} for order ${orderInfo.orderNumber}`);
        }
      } catch (emailError) {
        console.error("Failed to send delivery confirmation email:", emailError);
      }
    }

    return new Response(
      superjson.stringify({ success: true } satisfies OutputType)
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
      return new Response(superjson.stringify({ error: "Order not found" }), {
        status: 404,
      });
    }
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}