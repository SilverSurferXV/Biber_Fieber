import { schema, OutputType } from "./save_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") throw new Error("Forbidden");
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const now = new Date();
    let savedSupplier;

    if (input.id) {
      savedSupplier = await db
        .updateTable("suppliers")
        .set({
          name: input.name,
          contactPerson: input.contactPerson,
          email: input.email,
          phone: input.phone,
          address: input.address,
          notes: input.notes,
          active: input.active ?? true,
          updatedAt: now,
        })
        .where("id", "=", input.id)
        .returningAll()
        .executeTakeFirstOrThrow();
    } else {
      savedSupplier = await db
        .insertInto("suppliers")
        .values({
          name: input.name,
          contactPerson: input.contactPerson,
          email: input.email,
          phone: input.phone,
          address: input.address,
          notes: input.notes,
          active: input.active ?? true,
          updatedAt: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    return new Response(superjson.stringify(savedSupplier satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: error.message === "Forbidden" ? 403 : 400 });
  }
}