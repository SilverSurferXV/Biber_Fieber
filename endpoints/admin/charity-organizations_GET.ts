import { schema, OutputType } from "./charity-organizations_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") throw new Error("Forbidden");

    const orgs = await db
      .selectFrom("charityOrganizations")
      .selectAll()
      .orderBy("name", "asc")
      .execute();

    const output: OutputType = orgs.map((org) => ({
      ...org,
      totalPointsEarned: Number(org.totalPointsEarned),
    }));

    return new Response(superjson.stringify(output satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), {
      status: error.message === "Forbidden" ? 403 : 400,
    });
  }
}