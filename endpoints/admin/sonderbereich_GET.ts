import { schema, OutputType } from "./sonderbereich_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") throw new Error("Forbidden");
    const input = schema.parse({});

    const files = await db
      .selectFrom("sonderbereichFiles")
      .selectAll()
      .orderBy("uploadDate", "desc")
      .execute();

    return new Response(superjson.stringify(files satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: error.message === "Forbidden" ? 403 : 400 });
  }
}