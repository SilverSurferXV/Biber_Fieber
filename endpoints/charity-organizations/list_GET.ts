import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";

export async function handle(request: Request) {
  try {
    const orgs = await db
      .selectFrom("charityOrganizations")
      .select(["id", "name", "description"])
      .where("active", "=", true)
      .orderBy("name", "asc")
      .execute();

    return new Response(superjson.stringify(orgs satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), {
      status: 400,
    });
  }
}