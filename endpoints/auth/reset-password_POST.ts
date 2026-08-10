import { schema, OutputType } from "./reset-password_POST.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { generatePasswordHash } from "../../helpers/generatePasswordHash";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const now = new Date();

    const tokens = await db
      .selectFrom("passwordResetTokens")
      .select(["id", "userId", "expiresAt"])
      .where("token", "=", input.token)
      .where("used", "=", false)
      .where("expiresAt", ">", now)
      .limit(1)
      .execute();

    if (tokens.length === 0) {
      return new Response(
        superjson.stringify({ error: "Der Link ist ungültig oder abgelaufen." }),
        { status: 400 }
      );
    }

    const tokenRow = tokens[0];

    const passwordHash = await generatePasswordHash(input.password);

    await db.transaction().execute(async (trx) => {
      // mark token as used
      await trx
        .updateTable("passwordResetTokens")
        .set({ used: true })
        .where("id", "=", tokenRow.id)
        .execute();

      // update password
      const existingPassword = await trx
        .selectFrom("userPasswords")
        .select("id")
        .where("userId", "=", tokenRow.userId)
        .limit(1)
        .execute();

      if (existingPassword.length > 0) {
        await trx
          .updateTable("userPasswords")
          .set({ passwordHash })
          .where("userId", "=", tokenRow.userId)
          .execute();
      } else {
        await trx
          .insertInto("userPasswords")
          .values({ userId: tokenRow.userId, passwordHash })
          .execute();
      }
      
      // Optionally clear existing active sessions for security
      await trx
        .deleteFrom("sessions")
        .where("userId", "=", tokenRow.userId)
        .execute();
    });

    return new Response(
      superjson.stringify({
        success: true,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Reset password error:", error);
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return new Response(superjson.stringify({ error: message }), {
      status: 400,
    });
  }
}