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

    const row = await db
      .selectFrom("appSettings")
      .select("id")
      .limit(1)
      .executeTakeFirst();

    if (row) {
      await db
        .updateTable("appSettings")
        .set({
          bonusTiers: superjson.stringify(input.tiers),
          updatedAt: new Date(),
        })
        .where("id", "=", row.id)
        .execute();
    } else {
      await db
        .insertInto("appSettings")
        .values({
          bonusTiers: superjson.stringify(input.tiers),
          updatedAt: new Date(),
        })
        .execute();
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error: any) {
    return new Response(
      superjson.stringify({ error: error.message }),
      { status: error.message === "Forbidden" ? 403 : 400 }
    );
  }
}