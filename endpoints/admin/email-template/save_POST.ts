import superjson from "superjson";
import { schema, OutputType } from "./save_POST.schema";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { db } from "../../../helpers/db";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    if (user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const text = await request.text();
    const json = superjson.parse(text);
    const result = schema.parse(json);

    await db
      .updateTable("emailTemplates")
      .set({
        subject: result.subject,
        htmlBody: result.htmlBody,
        updatedAt: new Date(),
      })
      .where("id", "=", result.id)
      .execute();

    return new Response(
      superjson.stringify({ success: true } satisfies OutputType)
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