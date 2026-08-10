import { schema, OutputType } from "./save_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") {
      throw new Error("Forbidden");
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const values = {
      enabledLanguages: input.enabledLanguages as any, // Using as any so jsonb binding doesn't complain
      updatedAt: new Date(),
    };

    const row = await db
      .selectFrom("appSettings")
      .select("id")
      .limit(1)
      .executeTakeFirst();

    if (row) {
      await db
        .updateTable("appSettings")
        .set(values)
        .where("id", "=", row.id)
        .execute();
    } else {
      await db
        .insertInto("appSettings")
        .values(values)
        .execute();
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error: any) {
    const status = error.message === "Forbidden" || error.name === "NotAuthenticatedError" ? 403 : 400;
    return new Response(superjson.stringify({ error: error.message }), { status });
  }
}