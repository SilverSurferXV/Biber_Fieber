import { schema, OutputType } from "./validate_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code") || undefined;
    
    // Validate input using the schema
    const input = schema.parse({ code });

    // If no code is provided or it's empty, return not found immediately
    if (!input.code || input.code.trim() === "") {
      return new Response(
        superjson.stringify({ found: false, ownerName: null } satisfies OutputType)
      );
    }

    // Look up the user by bibercode (case-insensitive)
    const user = await db
      .selectFrom("users")
      .select(["firstName", "lastName"])
      .where("bibercode", "ilike", input.code.trim())
      .executeTakeFirst();

    if (user) {
      // Mask the last name for privacy
      const firstName = user.firstName || "Nutzer";
      const lastInitial = user.lastName ? `${user.lastName.charAt(0)}.` : "";
      const ownerName = `${firstName} ${lastInitial}`.trim();

      return new Response(
        superjson.stringify({ found: true, ownerName } satisfies OutputType)
      );
    }

    // User with the given bibercode not found
    return new Response(
      superjson.stringify({ found: false, ownerName: null } satisfies OutputType)
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(
      superjson.stringify({ error: errorMessage }),
      { status: 400 }
    );
  }
}