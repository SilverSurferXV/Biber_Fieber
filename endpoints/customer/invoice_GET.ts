import { schema, OutputType, InvoiceDayGroup, InvoiceCustomer } from "./invoice_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    const url = new URL(request.url);
    const monthStr = url.searchParams.get("month") || "";
    const input = schema.parse({ month: monthStr });

    const [year, month] = input.month.split("-").map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));

    // Fetch full user record for customer info
    const userRecord = await db
      .selectFrom("users")
      .where("id", "=", user.id)
      .select([
        "id",
        "displayName",
        "firstName",
        "lastName",
        "email",
        "streetAddress",
        "postcode",
        "city",
        "companyName",
      ])
      .executeTakeFirst();

    if (!userRecord) {
      return new Response(superjson.stringify({ error: "User not found" }), { status: 404 });
    }

    const customer: InvoiceCustomer = {
      id: userRecord.id,
      displayName: userRecord.displayName,
      firstName: userRecord.firstName,
      lastName: userRecord.lastName,
      email: userRecord.email,
      streetAddress: userRecord.streetAddress,
      postcode: userRecord.postcode,
      city: userRecord.city,
      companyName: userRecord.companyName,
    };

    // Fetch orders for this month
    const orders = await db
      .selectFrom("orders")
            .where("customerId", "=", user.id)
      .where("orderDate", ">=", startDate)
      .where("orderDate", "<", endDate)
      .where("status", "!=", "cancelled")
      .selectAll()
      .orderBy("orderDate", "asc")
      .execute();

    let allOrderItems: any[] = [];
    if (orders.length > 0) {
      allOrderItems = await db
        .selectFrom("orderItems")
        .where("orderId", "in", orders.map((o) => o.id))
        .selectAll()
        .execute();
    }

    // Fetch bibercode points earned this month
    const pointTransactions = await db
      .selectFrom("pointTransactions")
      .where("customerId", "=", user.id)
      .where("type", "=", "bibercode_credit")
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<", endDate)
      .select(({ fn }) => [fn.sum("amount").as("totalPoints")])
      .executeTakeFirst();

    const totalBibercodePointsEarned = parseFloat(String(pointTransactions?.totalPoints || 0));

    // Fetch wallet topup bonus points earned this month
    // Bonus points = points_credited - amount (the extra points from bonus percentage)
    const topupRows = await db
      .selectFrom("walletTopups")
      .where("customerId", "=", user.id)
      .where("topupDate", ">=", startDate)
      .where("topupDate", "<", endDate)
      .select(({ fn }) => [
        fn.sum("pointsCredited").as("totalPointsCredited"),
        fn.sum("amount").as("totalAmount"),
      ])
      .executeTakeFirst();

    const totalTopupBonusPoints =
      parseFloat(String(topupRows?.totalPointsCredited || 0)) -
      parseFloat(String(topupRows?.totalAmount || 0));

    let monthTotal = 0;
    const ordersByDay: Record<string, typeof orders & { items: any[] }> = {};

    for (const order of orders) {
      const orderTotal = order.total != null ? parseFloat(String(order.total)) : 0;
      monthTotal += orderTotal;

      const dateStr = order.orderDate ? order.orderDate.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' }) : "";
      if (!dateStr) continue;

      if (!ordersByDay[dateStr]) {
        ordersByDay[dateStr] = [] as any;
      }

      const items = allOrderItems
        .filter((item) => item.orderId === order.id)
        .map((item) => ({
          ...item,
          unitPrice: parseFloat(String(item.unitPrice)),
          taxRate: item.taxRate != null ? parseFloat(String(item.taxRate)) : null,
        }));

      (ordersByDay[dateStr] as any).push({
        ...order,
        subtotal: order.subtotal != null ? parseFloat(String(order.subtotal)) : null,
        deliveryFee: order.deliveryFee != null ? parseFloat(String(order.deliveryFee)) : null,
        total: orderTotal,
        pointsEarned: order.pointsEarned != null ? parseFloat(String(order.pointsEarned)) : null,
        pointsUsed: order.pointsUsed != null ? parseFloat(String(order.pointsUsed)) : null,
        bibercodePointsCredited: order.bibercodePointsCredited != null ? parseFloat(String(order.bibercodePointsCredited)) : null,
        items,
      });
    }

    const days: InvoiceDayGroup[] = Object.keys(ordersByDay)
      .sort()
      .map((date) => ({
        date,
        orders: ordersByDay[date] as any,
      }));

    return new Response(
      superjson.stringify({
        month: input.month,
        total: monthTotal,
        totalBibercodePointsEarned,
        totalTopupBonusPoints,
        customer,
        days,
      } satisfies OutputType)
    );
  } catch (error: any) {
    if (error.name === "NotAuthenticatedError") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    return new Response(superjson.stringify({ error: error.message }), { status: 400 });
  }
}