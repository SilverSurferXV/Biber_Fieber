import { schema, OutputType } from "./forgot-password_POST.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { sendPasswordResetEmail } from "../../helpers/sendPasswordResetEmail";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const users = await db
      .selectFrom("users")
      .select(["id", "firstName", "email"])
      .where("email", "=", input.email)
      .where("active", "=", true)
      .limit(1)
      .execute();

    if (users.length > 0) {
      const user = users[0];
      const url = new URL(request.url);

      try {
        await sendPasswordResetEmail({
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          origin: url.origin,
          reason: "requested",
        });
      } catch (emailError) {
        console.error("Failed to send reset email:", emailError);
      }
    }

    // Always return success even if user not found to prevent email enumeration
    return new Response(
      superjson.stringify({
        success: true,
        message: "Falls die E-Mail-Adresse existiert, wurde eine E-Mail gesendet.",
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    return new Response(superjson.stringify({ error: "Internal server error" }), {
      status: 400,
    });
  }
}