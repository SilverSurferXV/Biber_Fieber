import { schema, OutputType } from "./cancel_POST.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { sql } from "kysely";

/**
 * Returns today's date string in YYYY-MM-DD format using the Europe/Berlin timezone.
 */
function getBerlinDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Returns the current hour (0-23) in the Europe/Berlin timezone.
 */
function getBerlinHour(date: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    hour: "numeric",
    hour12: false,
  });
  return parseInt(formatter.format(date), 10) % 24;
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const order = await db
      .selectFrom("orders")
      .selectAll()
      .where("id", "=", input.orderId)
      .executeTakeFirst();

    if (!order) {
      return new Response(
        superjson.stringify({ error: "Bestellung nicht gefunden." }),
        { status: 404 }
      );
    }

    if (order.customerId !== user.id) {
      return new Response(
        superjson.stringify({ error: "Keine Berechtigung für diese Bestellung." }),
        { status: 403 }
      );
    }

    if (order.status !== "pending") {
      return new Response(
        superjson.stringify({
          error: "Nur Bestellungen im Status 'pending' können storniert werden.",
        }),
        { status: 400 }
      );
    }

    const now = new Date();
    const todayBerlin = getBerlinDateString(now);

    // Determine the delivery date from the order
    const deliveryVal = order.deliveryDate || order.preferredDeliveryDay;

    let refundPercentage = 0;

    if (deliveryVal) {
      let deliveryDateBerlin: string | null = null;
      try {
        const deliveryDate = new Date(deliveryVal as string | number | Date);
        if (!isNaN(deliveryDate.getTime())) {
          deliveryDateBerlin = getBerlinDateString(deliveryDate);
        }
      } catch {
        console.error("Failed to parse delivery date:", deliveryVal);
      }

      if (deliveryDateBerlin) {
        if (todayBerlin < deliveryDateBerlin) {
          // Future delivery → full refund, no cancellation fee
          console.log(`Order ${order.id}: Cancellation before delivery day (today: ${todayBerlin}, delivery: ${deliveryDateBerlin}) → 100% refund`);
          refundPercentage = 100;
        } else if (todayBerlin === deliveryDateBerlin) {
          // It's the delivery day → apply time-based rules
          const hour = getBerlinHour(now);
          console.log(`Order ${order.id}: Cancellation on delivery day at hour ${hour} (Berlin)`);
          if (hour < 12) {
            refundPercentage = 100;
          } else if (hour < 21) {
            refundPercentage = 50;
          } else {
            refundPercentage = 0;
          }
        } else {
          // Past delivery date → 0% refund, 100% fee
          console.log(`Order ${order.id}: Cancellation after delivery day (today: ${todayBerlin}, delivery: ${deliveryDateBerlin}) → 0% refund`);
          refundPercentage = 0;
        }
      } else {
        // Date parsing failed → apply time-based rules as fallback
        const hour = getBerlinHour(now);
        console.log(`Order ${order.id}: Date parsing failed, applying time-based rules at hour ${hour} (Berlin)`);
        if (hour < 12) {
          refundPercentage = 100;
        } else if (hour < 21) {
          refundPercentage = 50;
        } else {
          refundPercentage = 0;
        }
      }
    } else {
      // No delivery date set → fall back to time-based rules
      const hour = getBerlinHour(now);
      console.log(`Order ${order.id}: No delivery date set, applying time-based rules at hour ${hour} (Berlin)`);
      if (hour < 12) {
        refundPercentage = 100;
      } else if (hour < 21) {
        refundPercentage = 50;
      } else {
        refundPercentage = 0;
      }
    }

    const total = order.total ? Number(order.total) : 0;
    const pointsRefunded = (total * refundPercentage) / 100;

    console.log(`Order ${order.id}: refundPercentage=${refundPercentage}, pointsRefunded=${pointsRefunded}`);

    await db.transaction().execute(async (trx) => {
      // 1. Update order status to cancelled
      await trx
        .updateTable("orders")
        .set({ status: "cancelled" })
        .where("id", "=", input.orderId)
        .execute();

      // 2. Process points refund if applicable
      if (pointsRefunded > 0) {
        await trx
          .updateTable("users")
          .set({
            pointsBalance: sql`COALESCE(points_balance, 0) + ${pointsRefunded}`,
          })
          .where("id", "=", user.id)
          .execute();

        await trx
          .insertInto("pointTransactions")
          .values({
            customerId: user.id,
            amount: pointsRefunded,
            type: "order_payment",
            referenceId: String(order.id),
            note: `Stornierung Erstattung: ${refundPercentage}%`,
          })
          .execute();
      }
    });

    return new Response(
      superjson.stringify({
        success: true,
        pointsRefunded,
        refundPercentage,
      } satisfies OutputType)
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    const isAuthError = error instanceof Error && error.name === "NotAuthenticatedError";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: isAuthError ? 401 : 400,
    });
  }
}