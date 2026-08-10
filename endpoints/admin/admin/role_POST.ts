import { db } from '../../../helpers/db';
import { schema, OutputType } from "./role_POST.schema";
import { getServerUserSession } from '../../../helpers/getServerUserSession';
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Find the target user by email
    const targetUsers = await db
      .selectFrom("users")
      .select(["id", "role"])
      .where("email", "=", input.email)
      .limit(1)
      .execute();

    if (targetUsers.length === 0) {
      return new Response(superjson.stringify({ error: "User not found" }), { status: 404 });
    }

    const targetUser = targetUsers[0];

    // Prevent demoting oneself
    if (input.role === "user" && targetUser.id === user.id) {
      return new Response(superjson.stringify({ error: "Cannot demote yourself" }), { status: 400 });
    }

    await db
      .updateTable("users")
      .set({ role: input.role, updatedAt: new Date() })
      .where("id", "=", targetUser.id)
      .execute();

    return new Response(
      superjson.stringify({ success: true, userId: targetUser.id } satisfies OutputType),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Admin role change error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}