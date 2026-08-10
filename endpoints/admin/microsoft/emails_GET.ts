import { schema, OutputType } from "./emails_GET.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { getMicrosoftAccessToken } from "@floot/microsoft-integrations";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") {
      throw new Error("Forbidden");
    }

    const settings = await db
      .selectFrom("appSettings")
      .select(["microsoftConnectedEmail"])
      .limit(1)
      .executeTakeFirst();

    if (!settings?.microsoftConnectedEmail) {
      throw new Error("No Microsoft account connected");
    }

        let access_token: string;
    try {
      const result = await getMicrosoftAccessToken(db, settings.microsoftConnectedEmail);
      access_token = result.access_token;
    } catch (e: any) {
      if (e.name === "MicrosoftIntegrationsError" && (e.code === "no_connection" || e.code === "reconnect_required")) {
        return new Response(superjson.stringify({ error: "Microsoft Reconnect Required" }), { status: 401 });
      }
      throw e;
    }

    const graphUrl = `https://graph.microsoft.com/v1.0/me/messages?$top=50&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,bodyPreview,isRead,body,hasAttachments,categories`;

    const msResponse = await fetch(graphUrl, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const responseText = await msResponse.text();

    if (!responseText) {
      return new Response(superjson.stringify([] as OutputType));
    }

    if (!msResponse.ok) {
      throw new Error(`Failed to fetch emails: ${responseText}`);
    }

    const json = JSON.parse(responseText);
    const messages = Array.isArray(json.value) ? json.value : [];

    return new Response(superjson.stringify(messages satisfies OutputType));
  } catch (error: any) {
    const status = error.message === "Forbidden" || error.name === "NotAuthenticatedError" ? 403 : error.status || 400;
    return new Response(superjson.stringify({ error: error.message }), { status });
  }
}