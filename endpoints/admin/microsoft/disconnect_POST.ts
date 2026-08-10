import { schema, OutputType } from "./disconnect_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { disconnectMicrosoft } from "@floot/microsoft-integrations";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") {
      throw new Error("Forbidden");
    }

    const settings = await db
      .selectFrom("appSettings")
      .select(["id", "microsoftConnectedEmail"])
      .limit(1)
      .executeTakeFirst();

    if (!settings || !settings.microsoftConnectedEmail) {
      throw new Error("No Microsoft account connected");
    }

    // Attempt to clear from Microsoft integration services
    try {
      await disconnectMicrosoft(db, settings.microsoftConnectedEmail);
    } catch (e: any) {
      console.warn("Could not disconnect from provider or already disconnected:", e.message);
    }

    // Set local DB status to null regardless to ensure user isn't stuck
    await db
      .updateTable("appSettings")
      .set({ microsoftConnectedEmail: null })
      .where("id", "=", settings.id)
      .execute();

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error: any) {
    const status = error.message === "Forbidden" || error.name === "NotAuthenticatedError" ? 403 : 400;
    return new Response(superjson.stringify({ error: error.message }), { status });
  }
}