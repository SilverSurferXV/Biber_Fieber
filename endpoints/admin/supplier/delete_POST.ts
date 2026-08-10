import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") throw new Error("Forbidden");
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Get the supplier name to nullify any products referencing it
    const supplier = await db
      .selectFrom("suppliers")
      .select("name")
      .where("id", "=", input.id)
      .executeTakeFirst();

    if (supplier) {
      await db
        .updateTable("products")
        .set({ supplier: null })
        .where("supplier", "=", supplier.name)
        .execute();
    }

    await db.deleteFrom("suppliers").where("id", "=", input.id).execute();

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: error.message === "Forbidden" ? 403 : 400 });
  }
}