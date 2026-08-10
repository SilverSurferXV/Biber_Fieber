import { schema, OutputType } from "./unread-count_GET.schema";
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
      return new Response(
        superjson.stringify({
          unreadCount: 0,
          connected: false,
        } satisfies OutputType)
      );
    }

    let access_token: string;
    try {
      const result = await getMicrosoftAccessToken(
        db,
        settings.microsoftConnectedEmail
      );
      access_token = result.access_token;
    } catch (e: any) {
      if (
        e.name === "MicrosoftIntegrationsError" &&
        (e.code === "no_connection" || e.code === "reconnect_required")
      ) {
        return new Response(
          superjson.stringify({
            unreadCount: 0,
            connected: false,
          } satisfies OutputType)
        );
      }
      throw e;
    }

    const graphUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox`;

    const msResponse = await fetch(graphUrl, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const responseText = await msResponse.text();

    if (!msResponse.ok) {
      throw new Error(`Failed to fetch inbox folder: ${responseText}`);
    }

    let unreadCount = 0;
    if (responseText) {
      const json = JSON.parse(responseText);
      unreadCount = json.unreadItemCount || 0;
    }

    return new Response(
      superjson.stringify({
        unreadCount,
        connected: true,
      } satisfies OutputType)
    );
  } catch (error: any) {
    const status =
      error.message === "Forbidden" || error.name === "NotAuthenticatedError"
        ? 403
        : error.status || 400;
    return new Response(superjson.stringify({ error: error.message }), {
      status,
    });
  }
}