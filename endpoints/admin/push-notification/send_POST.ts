import { schema, OutputType } from "./send_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { ONESIGNAL_APP_ID } from "../../../helpers/_publicConfigs";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") throw new Error("Forbidden");

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const oneSignalApiKey = process.env.ONESIGNAL_REST_API_KEY;
    if (!oneSignalApiKey) {
      throw new Error("ONESIGNAL_REST_API_KEY environment variable is not set");
    }

    console.log(`Sending push notification via OneSignal: "${input.title}"`);

    const oneSignalResponse = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${oneSignalApiKey}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ["Subscribed Users"],
        headings: { en: input.title },
        contents: { en: input.message },
      }),
    });

    if (!oneSignalResponse.ok) {
      const errorBody = await oneSignalResponse.text();
      console.error("OneSignal API error:", oneSignalResponse.status, errorBody);
      throw new Error(`OneSignal API error (${oneSignalResponse.status}): ${errorBody}`);
    }

    const oneSignalResult = await oneSignalResponse.json() as { id?: string; errors?: string[] };
    console.log("OneSignal notification sent successfully, id:", oneSignalResult.id);

    await db
      .insertInto("pushNotificationLog")
      .values({
        title: input.title,
        message: input.message,
        sentByAdminId: user.id,
      })
      .execute();

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Forbidden" ? 403 : 400;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}