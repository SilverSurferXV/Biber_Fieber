import { schema, OutputType } from "./mark-read_POST.schema";
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

    const json = superjson.parse(await request.text());
    const { messageId } = schema.parse(json);

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
          superjson.stringify({ error: "Microsoft Reconnect Required" }),
          { status: 401 }
        );
      }
      throw e;
    }

    const graphUrl = `https://graph.microsoft.com/v1.0/me/messages/${messageId}`;

    const msResponse = await fetch(graphUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isRead: true }),
    });

    const responseText = await msResponse.text();

    if (!msResponse.ok) {
      throw new Error(`Failed to mark email as read: ${responseText}`);
    }

    return new Response(
      superjson.stringify({ success: true } satisfies OutputType)
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