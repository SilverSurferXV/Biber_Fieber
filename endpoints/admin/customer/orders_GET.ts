import { db } from '../../../helpers/db';
import { schema, OutputType } from "./orders_GET.schema";
import { getServerUserSession } from '../../../helpers/getServerUserSession';
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const url = new URL(request.url);
    const customerIdParam = url.searchParams.get("customerId");
    const input = schema.parse({ customerId: customerIdParam });

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const orders = await db.
    selectFrom("orders").
    select(["id", "orderNumber", "orderDate", "total", "status"]).
    where("customerId", "=", input.customerId).
    where("orderDate", ">=", threeMonthsAgo).
    orderBy("orderDate", "desc").
    execute();

    const formattedOrders = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      orderDate: o.orderDate ? new Date(o.orderDate) : null,
      total: o.total ? Number(o.total) : null,
      status: o.status
    }));

    return new Response(
      superjson.stringify({
        orders: formattedOrders
      } satisfies OutputType),
      {
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error: unknown) {
    console.error("Admin customer orders error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400
    });
  }
}