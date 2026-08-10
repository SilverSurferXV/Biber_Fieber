import { schema, OutputType } from "./save_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") throw new Error("Forbidden");
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const values = {
      postcodePattern: input.postcodePattern,
      cityName: input.cityName ?? null,
      population: input.population ?? null,
      minimumOrderValue: input.minimumOrderValue.toString(),
      activationThreshold: input.activationThreshold ?? 0,
      active: input.active,
      deliveryFee: input.deliveryFee !== undefined ? input.deliveryFee.toString() : "0",
    };

    if (input.id) {
      await db.updateTable("deliveryZones").set(values).where("id", "=", input.id).execute();
    } else {
      await db.insertInto("deliveryZones").values(values).execute();
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: error.message === "Forbidden" ? 403 : 400 });
  }
}