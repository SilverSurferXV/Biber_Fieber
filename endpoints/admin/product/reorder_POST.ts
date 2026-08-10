import { schema, OutputType } from "./reorder_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    if (user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // We execute updates in a transaction for data consistency
    await db.transaction().execute(async (trx) => {
      for (const item of input.items) {
        await trx
          .updateTable("products")
          .set({ sortOrder: item.sortOrder })
          .where("id", "=", item.id)
          .execute();
      }
    });

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: 400 });
  }
}