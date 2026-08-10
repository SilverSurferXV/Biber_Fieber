import { schema, OutputType } from "./contact-settings_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") {
      throw new Error("Forbidden");
    }

    const settings = await db
      .selectFrom("appSettings")
      .select([
        "contactFromEmail",
        "contactFromName",
        "contactToEmail",
        "contactToName",
      ])
      .limit(1)
      .executeTakeFirst();

    const output: OutputType = {
      contactFromEmail: settings?.contactFromEmail ?? "service@biber-fieber.de",
      contactFromName: settings?.contactFromName ?? "Biber Fieber Kontakt",
      contactToEmail: settings?.contactToEmail ?? "kontakt@biber-fieber.de",
      contactToName: settings?.contactToName ?? "Biber Fieber",
    };

    return new Response(superjson.stringify(output satisfies OutputType));
  } catch (error: any) {
    const status = error.message === "Forbidden" || error.name === "NotAuthenticatedError" ? 403 : 400;
    return new Response(superjson.stringify({ error: error.message }), { status });
  }
}