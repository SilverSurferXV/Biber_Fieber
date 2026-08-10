import { db } from '../../../helpers/db';
import { schema, OutputType } from "./delete_POST.schema";
import { getServerUserSession } from '../../../helpers/getServerUserSession';
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Soft delete the driver
    await db
      .updateTable("users")
      .set({ active: false, updatedAt: new Date() })
      .where("id", "=", input.userId)
      .where("role", "=", "driver")
      .execute();

    return new Response(
      superjson.stringify({ success: true } satisfies OutputType),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}