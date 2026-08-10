import { schema, OutputType } from "./check_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { Selectable } from "kysely";
import { DeliveryZones } from "../../helpers/schema";

function postcodeMatchesPattern(postcode: string, pattern: string): boolean {
  if (pattern === postcode) return true;

  // Check for range pattern like "81241-81249" or "81241 - 81249"
  const rangeMatch = pattern.match(/^(\d{4,5})\s*-\s*(\d{4,5})$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    const code = parseInt(postcode, 10);
    if (!isNaN(code) && !isNaN(start) && !isNaN(end)) {
      return code >= Math.min(start, end) && code <= Math.max(start, end);
    }
    return false;
  }

  // Wildcard pattern
  const regexPattern = "^" + pattern.replace(/\*/g, ".*") + "$";
  try {
    return new RegExp(regexPattern).test(postcode);
  } catch (e) {
    return false;
  }
}

async function countActiveUsersMatchingZone(zone: Selectable<DeliveryZones>): Promise<number> {
  // Load all active users' postcodes and filter in JS (same wildcard logic)
  // This avoids complex SQL regex and keeps parity with the zone matching logic
  const activeUsers = await db
    .selectFrom("users")
    .where("active", "=", true)
    .select("postcode")
    .execute();

  const count = activeUsers.filter(
    (u) => u.postcode != null && postcodeMatchesPattern(u.postcode, zone.postcodePattern)
  ).length;

  console.log(
    `Zone ${zone.id} (${zone.postcodePattern}): ${count} active users match, activationThreshold=${zone.activationThreshold}`
  );

  return count;
}

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const postcode = url.searchParams.get("postcode") || "";
    const checkThreshold = url.searchParams.get("checkThreshold") === "true";
    const input = schema.parse({ postcode, checkThreshold });

    // Load all active delivery zones
    const activeZones = await db
      .selectFrom("deliveryZones")
      .where("active", "=", true)
      .selectAll()
      .execute();

    // Find the first zone where the postcode pattern matches
    const matchedZone = activeZones.find((zone) =>
      postcodeMatchesPattern(input.postcode, zone.postcodePattern)
    );

    if (!matchedZone || matchedZone.minimumOrderValue == null) {
      return new Response(superjson.stringify(null satisfies OutputType));
    }

    // If checkThreshold=true and activationThreshold is set, verify enough active users exist in that zone
    if (input.checkThreshold && matchedZone.activationThreshold != null) {
      const userCount = await countActiveUsersMatchingZone(matchedZone);
      if (userCount < matchedZone.activationThreshold) {
        console.log(
          `Zone ${matchedZone.id} (${matchedZone.postcodePattern}) is below activation threshold (${userCount} < ${matchedZone.activationThreshold}), treating as inactive.`
        );
        return new Response(superjson.stringify(null satisfies OutputType));
      }
    }

    // Fetch global delivery fee from appSettings
    const appSettings = await db.selectFrom("appSettings").select("deliveryFee").executeTakeFirst();
    const globalDeliveryFee = appSettings?.deliveryFee != null ? parseFloat(String(appSettings.deliveryFee)) : 0;

    return new Response(
      superjson.stringify({
        deliveryFee: globalDeliveryFee,
        minimumOrderValue: parseFloat(String(matchedZone.minimumOrderValue)),
      } satisfies OutputType)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(superjson.stringify({ error: message }), {
      status: 400,
    });
  }
}