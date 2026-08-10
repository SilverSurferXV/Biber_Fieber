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

    const values = {
      name: input.name,
      nameEn: input.nameEn ?? null,
      nameEs: input.nameEs ?? null,
      nameIt: input.nameIt ?? null,
      nameTr: input.nameTr ?? null,
      photoUrl: input.photoUrl,
      sortOrder: input.sortOrder,
      active: input.active,
    };

    if (input.id) {
      await db.updateTable("productCategories").set(values).where("id", "=", input.id).execute();
    } else {
      await db.insertInto("productCategories").values(values).execute();
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: error.message === "Forbidden" ? 403 : 400 });
  }
}