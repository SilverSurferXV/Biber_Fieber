import { OutputType, UpcomingDeliveryGroup } from "./upcoming-deliveries_GET.schema";
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

    // Determine 'today' on the server using local timezone (YYYY-MM-DD)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;

    // Fetch all active orders along with their customers' postcode and city
    const rawOrders = await db
      .selectFrom("orders")
      .innerJoin("users", "orders.customerId", "users.id")
      .where("orders.status", "!=", "cancelled")
      .select([
        "orders.id",
        "orders.deliveryDate",
        "orders.preferredDeliveryDay",
        "users.postcode",
        "users.city",
      ])
      .execute();

    // Fetch delivery zones mapping to city names
    const zones = await db
      .selectFrom("deliveryZones")
      .select(["postcodePattern", "cityName"])
      .execute();

    const zoneCityMap = new Map<string, string>();
    for (const z of zones) {
      if (z.cityName) {
        zoneCityMap.set(z.postcodePattern, z.cityName);
      }
    }

    // Group the orders by date and postcode
    const grouped = new Map<string, UpcomingDeliveryGroup>();

    for (const order of rawOrders) {
      const date = getEffectiveDeliveryDay(order);
      
      // Filter out orders that have no date or are strictly before today
      if (!date || date < todayStr) {
        continue;
      }

      const postcode = order.postcode || "Unknown";
      const key = `${date}_${postcode}`;

      if (!grouped.has(key)) {
        // Try getting city name from delivery zones, fallback to user city
        const cityName = zoneCityMap.get(postcode) || order.city || null;
        grouped.set(key, {
          date,
          postcode,
          cityName,
          stopCount: 0,
        });
      }

      // Increment stop count for this delivery day and postcode
      grouped.get(key)!.stopCount += 1;
    }

    const deliveries = Array.from(grouped.values());

    // Sort by date ascending, then postcode ascending
    deliveries.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.postcode.localeCompare(b.postcode);
    });

    return new Response(
      superjson.stringify({ deliveries } satisfies OutputType)
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}