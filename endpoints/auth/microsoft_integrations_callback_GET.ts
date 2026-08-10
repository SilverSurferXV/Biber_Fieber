import { getServerUserSession } from "../../helpers/getServerUserSession";
import {
  finalizeMicrosoftConnection,
  renderConnectionPopup,
} from "@floot/microsoft-integrations";
import { db } from "../../helpers/db";

export async function handle(request: Request): Promise<Response> {
  try {
    await getServerUserSession(request);
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("connection_code");
  const error = url.searchParams.get("error");

  if (error) {
    return renderConnectionPopup({ type: "MICROSOFT_INTEGRATION_ERROR", error });
  }

  if (!code) {
    return renderConnectionPopup({
      type: "MICROSOFT_INTEGRATION_ERROR",
      error: "missing_connection_code",
    });
  }

  let connection;
  try {
    connection = await finalizeMicrosoftConnection(db, { code });
    await db.updateTable("appSettings").set({ microsoftConnectedEmail: connection.email }).where("id", "=", 1).execute();
  } catch (e) {
    return renderConnectionPopup({
      type: "MICROSOFT_INTEGRATION_ERROR",
      error: "connection_failed",
      message: e instanceof Error ? e.message : String(e),
    });
  }

  return renderConnectionPopup({
    type: "MICROSOFT_INTEGRATION_SUCCESS",
    email: connection.email,
    scopes: connection.scopes,
  });
}
