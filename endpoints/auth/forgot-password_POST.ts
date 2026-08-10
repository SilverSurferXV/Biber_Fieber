import { schema, OutputType } from "./forgot-password_POST.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { randomBytes } from "crypto";
import { sendMailjetEmail } from "../../helpers/sendMailjetEmail";
import { replaceTemplateVars } from "../../helpers/replaceTemplateVars";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const users = await db
      .selectFrom("users")
      .select(["id", "firstName"])
      .where("email", "=", input.email)
      .where("active", "=", true)
      .limit(1)
      .execute();

    if (users.length > 0) {
      const user = users[0];

      // Invalidate previous unused tokens for the user
      await db
        .updateTable("passwordResetTokens")
        .set({ used: true })
        .where("userId", "=", user.id)
        .where("used", "=", false)
        .execute();

      // Generate a new 64 byte hex token
      const token = randomBytes(64).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db
        .insertInto("passwordResetTokens")
        .values({
          userId: user.id,
          token,
          expiresAt,
          used: false,
        })
        .execute();

      const url = new URL(request.url);
      const resetLink = `${url.origin}/passwort-reset?token=${token}`;
      const name = user.firstName || "Kunde";

      const templateVars: Record<string, string> = {
        name,
        resetLink,
      };

      // Load template from DB; fall back to hardcoded HTML if not found
      const emailTemplate = await db
        .selectFrom("emailTemplates")
        .selectAll()
        .where("slug", "=", "password_reset")
        .executeTakeFirst();

      let emailSubject: string;
      let emailHtml: string;

      if (emailTemplate) {
        emailSubject = replaceTemplateVars(emailTemplate.subject, templateVars);
        emailHtml = replaceTemplateVars(emailTemplate.htmlBody, templateVars);
        console.log(`Using DB email template for password reset (user ${user.id})`);
      } else {
        emailSubject = "Passwort zurücksetzen";
        emailHtml = `
          <div style="font-family: sans-serif; color: #333;">
            <h2>Hallo ${name},</h2>
            <p>Du hast angefordert, dein Passwort zurückzusetzen. Klicke auf den folgenden Link, um ein neues Passwort festzulegen:</p>
            <p><a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #6ECFB5; color: #122620; text-decoration: none; border-radius: 8px;">Passwort zurücksetzen</a></p>
            <p>Dieser Link ist für 1 Stunde gültig.</p>
            <p>Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.</p>
            <br />
            <p>Liebe Grüße,<br/>Dein Biber Fieber Team</p>
          </div>
        `;
        console.log(`No DB template found for 'password_reset', using hardcoded fallback (user ${user.id})`);
      }

      try {
        await sendMailjetEmail({
          to: [{ email: input.email }],
          from: { email: "noreply@biber-fieber.de", name: "Biber Fieber" },
          subject: emailSubject,
          html: emailHtml,
        });
      } catch (emailError) {
        console.error("Failed to send reset email via Mailjet:", emailError);
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