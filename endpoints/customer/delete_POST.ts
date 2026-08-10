import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { clearServerSession } from "../../helpers/getSetServerSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    // Parse to validate, even though it's empty
    schema.parse(superjson.parse(await request.text()));

    // Hard delete the user; FK constraints handle cascading deletes
    await db
      .deleteFrom("users")
      .where("id", "=", user.id)
      .execute();

    const response = new Response(superjson.stringify({ success: true } satisfies OutputType));
    clearServerSession(response);
    return response;
  } catch (error: any) {
    if (error.name === "NotAuthenticatedError") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    return new Response(superjson.stringify({ error: error.message }), { status: 400 });
  }
}