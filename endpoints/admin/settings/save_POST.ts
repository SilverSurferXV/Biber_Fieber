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
      defaultLanguage: input.defaultLanguage,
      deliveryDays: input.deliveryDays,
      deliveryTimeWindow: input.deliveryTimeWindow,
      facebookUrl: input.facebookUrl,
      instagramUrl: input.instagramUrl,
      openingHours: input.openingHours,
      orderCutoffTime: input.orderCutoffTime,
      shopLatitude: input.shopLatitude?.toString(),
      shopLocation: input.shopLocation,
      shopLongitude: input.shopLongitude?.toString(),
      tiktokUrl: input.tiktokUrl,
      whatsappNumber: input.whatsappNumber,
      youtubeUrl: input.youtubeUrl,
      freeDeliveryThreshold: input.freeDeliveryThreshold?.toString() ?? null,
      deliveryFee: input.deliveryFee?.toString() ?? null,
      updatedAt: new Date(),
    };

    const row = await db.selectFrom("appSettings").select("id").limit(1).executeTakeFirst();
    if (row) {
      await db.updateTable("appSettings").set(values).where("id", "=", row.id).execute();
    } else {
      await db.insertInto("appSettings").values(values).execute();
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: error.message === "Forbidden" ? 403 : 400 });
  }
}