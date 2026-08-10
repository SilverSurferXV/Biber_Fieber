import { schema, OutputType } from "./earnings_GET.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { sql } from "kysely";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized. Admin access required." }),
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const driverIdParam = url.searchParams.get("driverId");

    if (!driverIdParam) {
      return new Response(
        superjson.stringify({ error: "driverId query parameter is required." }),
        { status: 400 }
      );
    }

    const input = schema.parse({ driverId: Number(driverIdParam) });

    // 1. Get the driver's stop compensation and packaging compensation
    const driverRecord = await db
      .selectFrom("users")
      .select(["stopCompensation", "packagingCompensation", "pointsBalance"])
      .where("id", "=", input.driverId)
      .executeTakeFirst();

    if (!driverRecord) {
      return new Response(
        superjson.stringify({ error: "Driver not found." }),
        { status: 404 }
      );
    }

    const stopCompensation = parseFloat(
      String(driverRecord.stopCompensation ?? 0)
    );
    const packagingCompensation = parseFloat(
      String(driverRecord.packagingCompensation ?? 0)
    );
    const driverPointsBalance = parseFloat(
      String(driverRecord.pointsBalance ?? 0)
    );

    // 2. Query total tips received by this driver
    const tipsResult = await db
      .selectFrom("driverTips")
      .select(db.fn.sum("amount").as("totalTips"))
      .where("driverId", "=", input.driverId)
      .executeTakeFirst();

    const totalTipsReceived = parseFloat(String(tipsResult?.totalTips ?? 0));

    // 3. Query delivered orders assigned to this driver, grouped by effective delivery date
    const aggregatedData = await db
      .selectFrom("orders")
      .where("deliveryDriverId", "=", input.driverId)
      .where("status", "=", "delivered")
      .select([
        sql<string>`COALESCE(delivery_date::date, created_at::date)::text`.as("date"),
        sql<number>`COUNT(DISTINCT id)::int`.as("stopsCount"),
      ])
      .groupBy(sql`COALESCE(delivery_date::date, created_at::date)`)
      .orderBy(sql`COALESCE(delivery_date::date, created_at::date)`, "desc")
      .execute();

    // 4. Query distinct effective delivery dates where this driver was the packer
        const packagingDaysData = await db
      .selectFrom("orders")
      .select([
        sql<string>`COALESCE(delivery_date::date, created_at::date)::text`.as("date"),
      ])
      .where("packerDriverId", "=", input.driverId)
      .where("status", "=", "delivered")
      .groupBy(sql`COALESCE(delivery_date::date, created_at::date)`)
      .orderBy(sql`COALESCE(delivery_date::date, created_at::date)`, "desc")
      .execute();

    // 5. Process the daily stop earnings
    let totalEarnings = 0;
    let totalStops = 0;

    const dailyEarnings = aggregatedData.map((row) => {
      const stops = row.stopsCount ?? 0;
      const earnings = stops * stopCompensation;

      totalStops += stops;
      totalEarnings += earnings;

      return {
        date: row.date,
        stopsCount: stops,
        earnings,
      };
    });

    // 6. Process packaging days
    const packagingDays = packagingDaysData.map((row) => ({
      date: row.date,
    }));

    const totalPackagingEarnings = packagingDays.length * packagingCompensation;

    console.log(
      `Admin earnings lookup for driver ${input.driverId}: ${dailyEarnings.length} delivery days, ${packagingDays.length} packaging days, totalTips: ${totalTipsReceived}, pointsBalance: ${driverPointsBalance}`
    );

    return new Response(
      superjson.stringify({
        stopCompensation,
        dailyEarnings,
        totalEarnings,
        totalStops,
        packagingCompensation,
        packagingDays,
        totalPackagingEarnings,
        driverPointsBalance,
        totalTipsReceived,
      } satisfies OutputType)
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}