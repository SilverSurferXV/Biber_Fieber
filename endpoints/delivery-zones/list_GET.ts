import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";

export async function handle(request: Request) {
  try {
    const json = await request.text();
    // Validate empty input to ensure valid structure
    if (json) {
      schema.parse(superjson.parse(json));
    } else {
      schema.parse({});
    }

    const zones = await db.selectFrom("deliveryZones").selectAll().execute();
    
    const users = await db
      .selectFrom("users")
      .select(["postcode"])
      .where("active", "=", true)
      .execute();

    const output: OutputType = zones.map((zone) => {
      const regexStr = "^" + zone.postcodePattern.replace(/\*/g, ".*") + "$";
      const regex = new RegExp(regexStr);
      let count = 0;
      for (const u of users) {
        if (u.postcode && regex.test(u.postcode)) count++;
      }
      return {
        postcodePattern: zone.postcodePattern,
        cityName: zone.cityName ?? null,
        activationThreshold: zone.activationThreshold ?? null,
        active: zone.active ?? false,
        userCount: count,
      };
    });

    return new Response(superjson.stringify(output satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: 400 });
  }
}