import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse({});

    const orders = await db.selectFrom("orders").selectAll().where("customerId", "=", user.id).orderBy("orderDate", "desc").execute();
    
    if (orders.length === 0) {
      return new Response(superjson.stringify([] satisfies OutputType));
    }

    const orderIds = orders.map((o) => o.id);
    const items = await db.selectFrom("orderItems").selectAll().where("orderId", "in", orderIds).execute();

    const output: OutputType = orders.map((o) => {
      const orderItems = items
        .filter((i) => i.orderId === o.id)
        .map((i) => ({
          ...i,
          unitPrice: Number(i.unitPrice),
          taxRate: i.taxRate ? Number(i.taxRate) : null,
        }));

      return {
        ...o,
        subtotal: o.subtotal ? Number(o.subtotal) : null,
        deliveryFee: o.deliveryFee ? Number(o.deliveryFee) : null,
        total: o.total ? Number(o.total) : null,
        pointsEarned: o.pointsEarned ? Number(o.pointsEarned) : null,
        pointsUsed: o.pointsUsed ? Number(o.pointsUsed) : null,
        bibercodePointsCredited: o.bibercodePointsCredited ? Number(o.bibercodePointsCredited) : null,
        items: orderItems,
      };
    });

    return new Response(superjson.stringify(output satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: error.name === "NotAuthenticatedError" ? 401 : 400 });
  }
}