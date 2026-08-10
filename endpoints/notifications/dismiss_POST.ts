import { schema, OutputType } from "./dismiss_POST.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const updateResult = await db
      .updateTable("userNotifications")
      .set({ dismissed: true })
      .where("id", "=", input.notificationId)
      .where("userId", "=", user.id)
      .executeTakeFirst();

    if (updateResult.numUpdatedRows === 0n) {
      throw new Error("Notification not found or already dismissed.");
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authenticated") ? 401 : 400;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}