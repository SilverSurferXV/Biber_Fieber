import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { OutputType } from "./driver-ratings_GET.schema";
import superjson from 'superjson';

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    if (user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    // Fetch aggregated ratings per driver
    const ratingsPromise = db.selectFrom("driverDeliveryRatings")
      .innerJoin("users", "users.id", "driverDeliveryRatings.driverId")
      .select(({ fn }) => [
        "users.id as driverId",
        "users.firstName",
        "users.lastName",
        fn.avg("driverDeliveryRatings.cleanRating").as("avgClean"),
        fn.avg("driverDeliveryRatings.noiseRating").as("avgNoise"),
        fn.avg("driverDeliveryRatings.placementRating").as("avgPlacement"),
        fn.count<number>("driverDeliveryRatings.id").as("totalRatings")
      ])
      .groupBy(["users.id", "users.firstName", "users.lastName"])
      .orderBy("users.firstName", "asc")
      .execute();

    // Fetch total tips per driver
    const tipsPromise = db.selectFrom("driverTips")
      .select(({ fn }) => [
        "driverId",
        fn.sum<number | string>("amount").as("totalTips")
      ])
      .groupBy("driverId")
      .execute();

    const [ratingsRows, tipsRows] = await Promise.all([ratingsPromise, tipsPromise]);
    
    // Map tips by driverId for fast lookup
    const tipsMap = new Map(tipsRows.map(t => [t.driverId, Number(t.totalTips) || 0]));

    const output: OutputType = ratingsRows.map(r => ({
      driverId: r.driverId,
      driverName: [r.firstName, r.lastName].filter(Boolean).join(" ") || "Unknown Driver",
      avgClean: Number(r.avgClean) || 0,
      avgNoise: Number(r.avgNoise) || 0,
      avgPlacement: Number(r.avgPlacement) || 0,
      totalRatings: Number(r.totalRatings) || 0,
      totalTips: tipsMap.get(r.driverId) || 0
    }));

    return new Response(superjson.stringify(output satisfies OutputType));
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Unknown error");
    return new Response(superjson.stringify({ error: err.message }), { status: 400 });
  }
}