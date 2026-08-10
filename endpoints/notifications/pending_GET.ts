import { schema, OutputType } from "./pending_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    const pending = await db
      .selectFrom("userNotifications")
      .select(["id", "title", "message", "createdAt"])
      .where("userId", "=", user.id)
      .where("dismissed", "=", false)
      .orderBy("createdAt", "desc")
      .execute();

    const result: OutputType = pending.map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      createdAt: row.createdAt instanceof Date 
        ? row.createdAt.toISOString() 
        : String(row.createdAt),
    }));

    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authenticated") ? 401 : 400;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}