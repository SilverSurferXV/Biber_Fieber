import { schema, OutputType } from "./status_GET.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") {
      throw new Error("Forbidden");
    }

    const settings = await db
      .selectFrom("appSettings")
      .select(["microsoftConnectedEmail"])
      .limit(1)
      .executeTakeFirst();

    const email = settings?.microsoftConnectedEmail || null;

    return new Response(
      superjson.stringify({
        connected: !!email,
        email,
      } satisfies OutputType)
    );
  } catch (error: any) {
    const status = error.message === "Forbidden" || error.name === "NotAuthenticatedError" ? 403 : 400;
    return new Response(superjson.stringify({ error: error.message }), { status });
  }
}