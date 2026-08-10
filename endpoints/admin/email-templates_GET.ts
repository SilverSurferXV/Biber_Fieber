import superjson from "superjson";
import { OutputType } from "./email-templates_GET.schema";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    if (user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const rows = await db
      .selectFrom("emailTemplates")
      .selectAll()
      .orderBy("id")
      .execute();

    const templates = rows.map((row) => {
      let variables: string[] = [];
      try {
        if (row.availableVariables) {
          variables = JSON.parse(row.availableVariables);
        }
      } catch (e) {
        console.warn(`Failed to parse availableVariables for template ID ${row.id}:`, e);
      }

      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        subject: row.subject,
        htmlBody: row.htmlBody,
        availableVariables: variables,
        description: row.description,
        updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
      };
    });

    return new Response(
      superjson.stringify({ templates } satisfies OutputType)
    );
  } catch (error: any) {
    if (error.name === "NotAuthenticatedError") {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    return new Response(
      superjson.stringify({ error: error.message }), { status: 400 }
    );
  }
}