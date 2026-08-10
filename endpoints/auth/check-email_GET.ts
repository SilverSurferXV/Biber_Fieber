import { schema, OutputType } from "./check-email_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const emailParam = url.searchParams.get("email");
    
    // Validate input using zod schema
    const result = schema.parse({ email: emailParam });

    // Check if the user exists in the database
    const user = await db
      .selectFrom("users")
      .select("id")
      .where("email", "=", result.email)
      .executeTakeFirst();

    return new Response(
      superjson.stringify({ exists: !!user } satisfies OutputType)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(superjson.stringify({ error: message }), {
      status: 400,
    });
  }
}