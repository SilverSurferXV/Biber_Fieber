import { schema, OutputType } from "./delete-email_POST.schema";
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
    } catch (e: unknown) {
      if (e instanceof Error) {
        const anyError = e as any;
        if (
          anyError.name === "MicrosoftIntegrationsError" &&
          (anyError.code === "no_connection" || anyError.code === "reconnect_required")
        ) {
          return new Response(
            superjson.stringify({ error: "Microsoft Reconnect Required" }),
            { status: 401 }
          );
        }
      }
      throw e;
    }

    const graphUrl = `https://graph.microsoft.com/v1.0/me/messages/${messageId}`;

    const msResponse = await fetch(graphUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const responseText = await msResponse.text();

    if (!msResponse.ok) {
      throw new Error(`Failed to delete email: ${responseText}`);
    }

    return new Response(
      superjson.stringify({ success: true } satisfies OutputType)
    );
  } catch (error: unknown) {
    let message = "An unknown error occurred";
    let status = 400;

    if (error instanceof Error) {
      message = error.message;
      if (message === "Forbidden" || error.name === "NotAuthenticatedError") {
        status = 403;
      } else if ((error as any).status) {
        status = (error as any).status;
      }
    }

    return new Response(superjson.stringify({ error: message }), {
      status,
    });
  }
}