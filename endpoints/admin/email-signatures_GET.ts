import { schema, OutputType } from "./email-signatures_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") throw new Error("Forbidden");

    // parse input to ensure valid request
    schema.parse({}); 

    const signatures = await db
      .selectFrom("emailSignatures")
      .selectAll()
      .orderBy("name", "asc")
      .execute();

    return new Response(superjson.stringify(signatures satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(superjson.stringify({ error: message }), {
      status: message === "Forbidden" ? 403 : 400,
    });
  }
}