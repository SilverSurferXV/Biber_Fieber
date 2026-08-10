import { schema, OutputType } from "./profile_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse({});

    const profile = await db.selectFrom("users").selectAll().where("id", "=", user.id).executeTakeFirst();
    if (!profile) {
      throw new Error("Profile not found");
    }

    const output: OutputType = {
      ...profile,
      pointsBalance: profile.pointsBalance ? Number(profile.pointsBalance) : null,
    };

    return new Response(superjson.stringify(output satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: error.name === "NotAuthenticatedError" ? 401 : 400 });
  }
}