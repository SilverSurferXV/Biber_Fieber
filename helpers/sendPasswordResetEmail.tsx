import { db } from "./db";
import { randomBytes } from "crypto";
import { sendMailjetEmail } from "./sendMailjetEmail";
import { replaceTemplateVars } from "./replaceTemplateVars";

export async function sendPasswordResetEmail(params: {
  userId: number;
  email: string;
  firstName?: string | null;
  origin: string;
  reason: "requested" | "too_many_failed_attempts";
}): Promise<{ sent: boolean; token: string }> {
  const { userId, email, firstName, origin, reason } = params;

  // Invalidate previous unused tokens for the user
  await db
    .updateTable("passwordResetTokens")
    .set({ used: true })
    .where("userId", "=", userId)
    .where("used", "=", false)
    .execute();

  // Generate a new 64 byte hex token
  const token = randomBytes(64).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db
    .insertInto("passwordResetTokens")
    .values({
      userId,
      token,
      expiresAt,
      used: false,
    })
    .execute();

  const resetLink = `${origin}/passwort-reset?token=${token}`;
  const name = firstName || "Kunde";

  const templateVars: Record<string, string> = {
    name,
    resetLink,
  };

  const templateSlug =
    reason === "requested" ? "password_reset" : "password_reset_lockout";

  // Load template from DB; fall back to hardcoded HTML if not found
  const emailTemplate = await db
    .selectFrom("emailTemplates")
    .selectAll()
    .where("slug", "=", templateSlug)
    .executeTakeFirst();

  let emailSubject: string;
  let emailHtml: string;

  if (emailTemplate) {
    emailSubject = replaceTemplateVars(emailTemplate.subject, templateVars);
    emailHtml = replaceTemplateVars(emailTemplate.htmlBody, templateVars);
    console.log(`Using DB email template for ${templateSlug} (user ${userId})`);
  } else {
    console.log(
      `No DB template found for '${templateSlug}', using hardcoded fallback (user ${userId})`
    );
    if (reason === "requested") {
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
    } else {
      emailSubject = "Passwort aus Sicherheitsgründen zurückgesetzt";
      emailHtml = `
        <div style="font-family: sans-serif; color: #333;">
          <h2>Hallo ${name},</h2>
          <p>Aufgrund von zu vielen fehlgeschlagenen Anmeldeversuchen haben wir dein Passwort aus Sicherheitsgründen zurückgesetzt. Dein altes Passwort ist nicht mehr gültig.</p>
          <p>Klicke auf den folgenden Link, um ein neues Passwort festzulegen:</p>
          <p><a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #6ECFB5; color: #122620; text-decoration: none; border-radius: 8px;">Passwort zurücksetzen</a></p>
          <p>Dieser Link ist für 1 Stunde gültig.</p>
          <br />
          <p>Liebe Grüße,<br/>Dein Biber Fieber Team</p>
        </div>
      `;
    }
  }

  try {
    await sendMailjetEmail({
      to: [{ email }],
      from: { email: "noreply@biber-fieber.de", name: "Biber Fieber" },
      subject: emailSubject,
      html: emailHtml,
    });
    return { sent: true, token };
  } catch (emailError) {
    console.error("Failed to send reset email via Mailjet:", emailError);
    return { sent: false, token };
  }
}