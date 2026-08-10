import { OutputType } from "./admins_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") throw new Error("Forbidden");

    const admins = await db
      .selectFrom("users")
      .select([
        "id",
        "firstName",
        "lastName",
        "email",
        "mobileNumber",
        "active",
        "createdAt",
      ])
      .where("role", "=", "admin")
      .orderBy("createdAt", "desc")
      .execute();

    return new Response(superjson.stringify(admins satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(superjson.stringify({ error: message }), {
      status: message === "Forbidden" ? 403 : 400,
    });
  }
}