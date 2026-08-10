import { schema, OutputType } from "./delivery-zones_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") throw new Error("Forbidden");
    const input = schema.parse({});

    const zones = await db.selectFrom("deliveryZones").selectAll().execute();
    const users = await db.selectFrom("users").select(["postcode", "active"]).where("active", "=", true).execute();

    const output: OutputType = zones.map((zone) => {
      const regexStr = "^" + zone.postcodePattern.replace(/\*/g, ".*") + "$";
      const regex = new RegExp(regexStr);
      let count = 0;
      for (const u of users) {
        if (u.postcode && regex.test(u.postcode)) count++;
      }
      return {
        ...zone,
        deliveryFee: Number(zone.deliveryFee || 0),
        minimumOrderValue: Number(zone.minimumOrderValue || 0),
        activationThreshold: zone.activationThreshold ?? null,
        cityName: zone.cityName ?? null,
        population: zone.population ?? null,
        userCount: count,
      };
    });

    return new Response(superjson.stringify(output satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: error.message === "Forbidden" ? 403 : 400 });
  }
}