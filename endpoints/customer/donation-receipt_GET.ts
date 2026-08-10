import { schema, OutputType } from "./donation-receipt_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    const url = new URL(request.url);
    const monthStr = url.searchParams.get("month") || "";
    const input = schema.parse({ month: monthStr });

    // Fetch charityOrganizationId from DB since it's not on the User session type
    const userRecord = await db
      .selectFrom("users")
      .where("id", "=", user.id)
      .select(["charityOrganizationId"])
      .executeTakeFirst();

    if (!userRecord?.charityOrganizationId) {
      return new Response(
        superjson.stringify({ error: "Keine Spendenorganisation ausgewählt." }), 
        { status: 400 }
      );
    }

    const organization = await db
      .selectFrom("charityOrganizations")
      .where("id", "=", userRecord.charityOrganizationId)
      .select([
        "name",
        "streetAddress",
        "postcode",
        "city",
        "contactPerson",
        "registerNumber",
        "logoUrl"
      ])
      .executeTakeFirst();

    if (!organization) {
      return new Response(
        superjson.stringify({ error: "Spendenorganisation nicht gefunden." }), 
        { status: 404 }
      );
    }

    const [year, month] = input.month.split("-").map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));

    // Fetch delivered orders for this month
    const orders = await db
      .selectFrom("orders")
      .where("customerId", "=", user.id)
      .where("status", "=", "delivered")
      .where("orderDate", ">=", startDate)
      .where("orderDate", "<", endDate)
      .select(["id", "orderNumber", "orderDate"])
      .orderBy("orderDate", "asc")
      .execute();

    let allOrderItems: any[] = [];
    if (orders.length > 0) {
      allOrderItems = await db
        .selectFrom("orderItems")
        .where("orderId", "in", orders.map((o) => o.id))
        .select(["orderId", "unitPrice", "quantity"])
        .execute();
    }

    let totalNetSubtotal = 0;
    let totalDonation = 0;
    const processedOrders: OutputType["orders"] = [];

    for (const order of orders) {
      const items = allOrderItems.filter((item) => item.orderId === order.id);
      
      let netSubtotal = 0;
      for (const item of items) {
        const price = item.unitPrice != null ? parseFloat(String(item.unitPrice)) : 0;
        const qty = item.quantity != null ? Number(item.quantity) : 0;
        netSubtotal += price * qty;
      }

      const donationAmount = netSubtotal * 0.05; // 5% donation rule

      totalNetSubtotal += netSubtotal;
      totalDonation += donationAmount;

      processedOrders.push({
        orderNumber: order.orderNumber,
        orderDate: order.orderDate ? order.orderDate.toISOString() : "",
        netSubtotal,
        donationAmount,
      });
    }

    // Build user info
    const customerName = user.displayName || [user.firstName, user.lastName].filter(Boolean).join(" ");
    
    // Fetch full user record to grab address fields since session user might omit some
    const fullUser = await db
      .selectFrom("users")
      .where("id", "=", user.id)
      .select(["streetAddress", "postcode", "city"])
      .executeTakeFirst();

    const customerAddressLines = [];
    if (fullUser?.streetAddress) customerAddressLines.push(fullUser.streetAddress);
    const zipCity = `${fullUser?.postcode || ""} ${fullUser?.city || ""}`.trim();
    if (zipCity) customerAddressLines.push(zipCity);

    return new Response(
      superjson.stringify({
        month: input.month,
        organization,
        customerName,
        customerAddress: customerAddressLines.join("\n"),
        orders: processedOrders,
        totalNetSubtotal,
        totalDonation,
      } satisfies OutputType)
    );
  } catch (error: any) {
    if (error.name === "NotAuthenticatedError") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    return new Response(superjson.stringify({ error: error.message }), { status: 400 });
  }
}