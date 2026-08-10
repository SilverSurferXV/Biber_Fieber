import { OutputType, DriverOrder } from "./orders_GET.schema";
import superjson from "superjson";
import { db } from '../../helpers/db';
import { getServerUserSession } from '../../helpers/getServerUserSession';
import { getEffectiveDeliveryDay } from '../../helpers/getEffectiveDeliveryDay';

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "driver") {
      return new Response(
        superjson.stringify({ error: "Unauthorized. Driver access required." }),
        { status: 403 }
      );
    }

    // Get current date string in YYYY-MM-DD using local server timezone
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;

        // Fetch the driver's own address information (drivers use billing address fields)
    const driverRecord = await db
      .selectFrom("users")
      .select(["streetAddress", "city", "postcode", "billingStreet", "billingCity", "billingPostcode"])
      .where("id", "=", user.id)
      .limit(1)
      .executeTakeFirst();

    const driverAddress = {
      streetAddress: driverRecord?.billingStreet ?? driverRecord?.streetAddress ?? null,
      city: driverRecord?.billingCity ?? driverRecord?.city ?? null,
      postcode: driverRecord?.billingPostcode ?? driverRecord?.postcode ?? null,
    };

    // Find assigned postcodes for this driver today
    const assignments = await db
      .selectFrom("zoneDriverAssignments")
      .select("postcode")
      .where("driverId", "=", user.id)
      .where("dateKey", "=", todayStr)
      .execute();

    const postcodes = assignments.map((a) => a.postcode);

    if (postcodes.length === 0) {
      return new Response(
        superjson.stringify({ orders: [], driverAddress, assignedPostcodes: postcodes } satisfies OutputType)
      );
    }

    // Query active orders and their associated customers for the assigned postcodes
    const rawOrders = await db
      .selectFrom("orders")
      .innerJoin("users", "orders.customerId", "users.id")
      .where((eb) => eb.or([eb("users.postcode", "in", postcodes), eb.and([eb("users.deliveryAddressSameAsBilling", "=", false), eb("users.deliveryPostcode", "in", postcodes)])]))
      .where("orders.status", "!=", "cancelled")
      .select([
        "orders.id",
        "orders.orderNumber",
        "orders.status",
        "orders.total",
        "orders.deliveryFee",
        "orders.subtotal",
        "orders.deliveryNote",
        "orders.createdAt",
        "orders.deliveryDate",
        "orders.preferredDeliveryDay",
        "users.firstName",
        "users.lastName",
        "users.streetAddress",
        "users.city",
        "users.postcode",
        "users.mobileNumber",
        "users.dropoffDescription",
        "users.dropoffPhotoUrl",
        "users.deliveryAddressSameAsBilling",
        "users.deliveryFirstName",
        "users.deliveryLastName",
        "users.deliveryStreet",
        "users.deliveryCity",
        "users.deliveryPostcode",
        "users.deliveryMobileNumber",
        "users.deliveryCompanyName",
      ])
      .execute();

    // Filter to effectively scheduled deliveries for today
    const todaysOrders = rawOrders.filter(
      (o) => getEffectiveDeliveryDay(o) === todayStr
    );

    if (todaysOrders.length === 0) {
      return new Response(
        superjson.stringify({ orders: [], driverAddress, assignedPostcodes: postcodes } satisfies OutputType)
      );
    }

    // Fetch order items for matched orders
    const orderIds = todaysOrders.map((o) => o.id);
    const orderItems = await db
      .selectFrom("orderItems")
      .where("orderId", "in", orderIds)
      .select(["orderId", "productName", "quantity", "unitPrice"])
      .execute();

    // Group items by orderId
    const itemsByOrderId = orderItems.reduce(
      (acc, item) => {
        const oId = item.orderId;
        if (oId === null) return acc;
        if (!acc[oId]) acc[oId] = [];
        acc[oId].push({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        });
        return acc;
      },
      {} as Record<
        number,
        Array<{ productName: string; quantity: number; unitPrice: string | number }>
      >
    );

    // Shape the resulting array
    const orders = todaysOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: o.total,
      deliveryFee: o.deliveryFee,
      subtotal: o.subtotal,
      deliveryNote: o.deliveryNote,
      createdAt: o.createdAt,
      deliveryDate: o.deliveryDate,
      preferredDeliveryDay: o.preferredDeliveryDay,
      customer: {
        firstName: o.deliveryAddressSameAsBilling === false ? (o.deliveryFirstName || o.firstName) : o.firstName,
        lastName: o.deliveryAddressSameAsBilling === false ? (o.deliveryLastName || o.lastName) : o.lastName,
        streetAddress: o.deliveryAddressSameAsBilling === false ? (o.deliveryStreet || o.streetAddress) : o.streetAddress,
        city: o.deliveryAddressSameAsBilling === false ? (o.deliveryCity || o.city) : o.city,
        postcode: o.deliveryAddressSameAsBilling === false ? (o.deliveryPostcode || o.postcode) : o.postcode,
        mobileNumber: o.deliveryAddressSameAsBilling === false ? (o.deliveryMobileNumber || o.mobileNumber) : o.mobileNumber,
        dropoffDescription: o.dropoffDescription,
        dropoffPhotoUrl: o.dropoffPhotoUrl,
      },
      items: itemsByOrderId[o.id] || [],
    })) as DriverOrder[];

    // Sort by postcode then customer last name
    orders.sort((a, b) => {
      const pcA = a.customer.postcode || "";
      const pcB = b.customer.postcode || "";
      if (pcA !== pcB) return pcA.localeCompare(pcB);

      const lnA = a.customer.lastName || "";
      const lnB = b.customer.lastName || "";
      return lnA.localeCompare(lnB);
    });

    return new Response(
      superjson.stringify({ orders, driverAddress, assignedPostcodes: postcodes } satisfies OutputType)
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}