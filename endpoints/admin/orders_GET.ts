import { schema, OutputType } from "./orders_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") throw new Error("Forbidden");
    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date");
    const pageParam = url.searchParams.get("page");
    const limitParam = url.searchParams.get("limit");
    const input = schema.parse({
      date: dateParam || undefined,
      page: pageParam || undefined,
      limit: limitParam || undefined,
    });

    let countQuery = db
      .selectFrom("orders")
      .select(db.fn.countAll().as("total"));

    if (input.date) {
      countQuery = countQuery.where("orderNumber", "like", `#${input.date}-%`);
    }

    const [{ total }] = await countQuery.execute();
    const totalCount = Number(total);

    let query = db
      .selectFrom("orders")
      .leftJoin("users", "users.id", "orders.customerId")
      .selectAll("orders")
      .select([
        "users.firstName",
        "users.lastName",
        "users.streetAddress",
        "users.city",
        "users.postcode",
        "users.mobileNumber",
      ])
      .orderBy("orders.orderDate", "desc");

    if (input.date) {
      query = query.where("orders.orderNumber", "like", `#${input.date}-%`);
    }

    query = query.limit(input.limit).offset((input.page - 1) * input.limit);

    const orders = await query.execute();

    if (orders.length === 0) {
      return new Response(
        superjson.stringify({
          orders: [],
          summary: {},
          totalCount,
          page: input.page,
          totalPages: Math.ceil(totalCount / input.limit),
        } satisfies OutputType)
      );
    }

    const orderIds = orders.map((o) => o.id);

    const items = await db
      .selectFrom("orderItems")
      .leftJoin("products", "orderItems.productId", "products.id")
      .select([
        "orderItems.id",
        "orderItems.orderId",
        "orderItems.productId",
        "orderItems.productName",
        "orderItems.quantity",
        "orderItems.unitPrice",
        "orderItems.taxRate",
        "products.costPriceEuro",
        "products.supplier",
        "products.articleNumber",
      ])
      .where("orderItems.orderId", "in", orderIds)
      .execute();

    const summary: Record<string, number> = {};

    const ordersParsed = orders.map((o) => {
      const orderItems = items
        .filter((i) => i.orderId === o.id)
        .map((i) => {
          if (!summary[i.productName]) summary[i.productName] = 0;
          summary[i.productName] += i.quantity || 0;

          return {
            ...i,
            unitPrice: Number(i.unitPrice),
            taxRate: i.taxRate ? Number(i.taxRate) : null,
            supplier: i.supplier ?? null,
            articleNumber: i.articleNumber ?? null,
            costPriceEuro: i.costPriceEuro ?? null,
          };
        });

      // Calculate wareneinsatz and db1 in a single loop
      const subtotalNum = o.subtotal ? Number(o.subtotal) : null;
      let wareneinsatz: number | null = null;
      let db1: number | null = null;
      if (subtotalNum && subtotalNum > 0 && orderItems.length > 0) {
        let totalCost = 0;
        let hasAllCosts = true;
        for (const item of orderItems) {
          const cost = item.costPriceEuro !== null ? Number(item.costPriceEuro) : null;
          if (cost === null) {
            hasAllCosts = false;
            break;
          }
          totalCost += cost * item.quantity;
        }
        if (hasAllCosts) {
          wareneinsatz = totalCost / subtotalNum;
          db1 = subtotalNum - totalCost;
        }
      }

      const firstName = o.firstName ?? null;
      const lastName = o.lastName ?? null;
      const customerName =
        firstName || lastName
          ? [firstName, lastName].filter(Boolean).join(" ")
          : null;

      const customerStreet = o.streetAddress ?? null;
      const customerCity = o.city ?? null;
      const customerPostcode = o.postcode ?? null;
      const customerMobile = o.mobileNumber ?? null;

      return {
        ...o,
        subtotal: o.subtotal ? Number(o.subtotal) : null,
        deliveryFee: o.deliveryFee ? Number(o.deliveryFee) : null,
        total: o.total ? Number(o.total) : null,
        pointsEarned: o.pointsEarned ? Number(o.pointsEarned) : null,
        pointsUsed: o.pointsUsed ? Number(o.pointsUsed) : null,
        bibercodePointsCredited: o.bibercodePointsCredited ? Number(o.bibercodePointsCredited) : null,
        customerName,
        customerStreet,
        customerCity,
        customerPostcode,
        customerMobile,
        wareneinsatz,
        db1,
        items: orderItems.map(({ costPriceEuro: _cost, ...item }) => item),
      };
    });

    return new Response(
      superjson.stringify({
        orders: ordersParsed,
        summary,
        totalCount,
        page: input.page,
        totalPages: Math.ceil(totalCount / input.limit),
      } satisfies OutputType)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(superjson.stringify({ error: message }), { status: message === "Forbidden" ? 403 : 400 });
  }
}