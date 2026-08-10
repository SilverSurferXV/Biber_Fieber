import { schema, OutputType } from "./send_POST.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { sendMailjetEmail } from "../../helpers/sendMailjetEmail";
import { replaceTemplateVars } from "../../helpers/replaceTemplateVars";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const templateVars: Record<string, string> = {
      name: input.name,
      email: input.email,
      telefon: input.telefon || "Nicht angegeben",
      betreff: input.betreff || "Nicht angegeben",
      nachricht: input.nachricht.replace(/\n/g, "<br>"),
    };

    // Load email template and app settings from DB in parallel
    const [emailTemplate, appSettings] = await Promise.all([
      db
        .selectFrom("emailTemplates")
        .selectAll()
        .where("slug", "=", "contact_form")
        .executeTakeFirst(),
      db
        .selectFrom("appSettings")
        .select(["contactFromEmail", "contactFromName", "contactToEmail", "contactToName"])
        .executeTakeFirst(),
    ]);

    let emailSubject: string;
    let emailHtml: string;

    if (emailTemplate) {
      emailSubject = replaceTemplateVars(emailTemplate.subject, templateVars);
      emailHtml = replaceTemplateVars(emailTemplate.htmlBody, templateVars);
      console.log(`Using DB email template for contact form (from ${input.email})`);
    } else {
      emailSubject = `Neue Kontaktanfrage von ${input.name}`;
      emailHtml = `
        <h2>Neue Kontaktanfrage</h2>
        <p><strong>Name:</strong> ${input.name}</p>
        <p><strong>E-Mail:</strong> ${input.email}</p>
        <p><strong>Telefon:</strong> ${input.telefon || "Nicht angegeben"}</p>
        <p><strong>Betreff:</strong> ${input.betreff || "Nicht angegeben"}</p>
        <hr />
        <h3>Nachricht:</h3>
        <p>${input.nachricht.replace(/\n/g, "<br>")}</p>
      `;
      console.log(`No DB template found for 'contact_form', using hardcoded fallback (from ${input.email})`);
    }

    const contactFromEmail = appSettings?.contactFromEmail || "service@biber-fieber.de";
    const contactFromName = appSettings?.contactFromName || "Biber Fieber Kontakt";
    const contactToEmail = appSettings?.contactToEmail || "kontakt@biber-fieber.de";
    const contactToName = appSettings?.contactToName || "Biber Fieber";

    await sendMailjetEmail({
      to: [{ email: contactToEmail, name: contactToName }],
      from: { email: contactFromEmail, name: contactFromName },
      subject: emailSubject,
      html: emailHtml,
    });

    return new Response(
      superjson.stringify({
        success: true,
        message: "Message sent successfully",
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Contact send error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(superjson.stringify({ error: message }), {
      status: 400,
    });
  }
}