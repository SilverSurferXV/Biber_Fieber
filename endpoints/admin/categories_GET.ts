import { schema, OutputType } from "./categories_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") throw new Error("Forbidden");
    const input = schema.parse({});

    const categories = await db
      .selectFrom("productCategories")
      .selectAll()
      .orderBy("sortOrder", "asc")
      .execute();

    return new Response(superjson.stringify(categories satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: error.message === "Forbidden" ? 403 : 400 });
  }
}