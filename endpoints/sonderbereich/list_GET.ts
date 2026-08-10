import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    await getServerUserSession(request);
    const input = schema.parse({});

    const files = await db
      .selectFrom("sonderbereichFiles")
      .selectAll()
      .where("active", "=", true)
      .orderBy("uploadDate", "desc")
      .execute();

    return new Response(superjson.stringify(files satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: error.name === "NotAuthenticatedError" ? 401 : 400 });
  }
}