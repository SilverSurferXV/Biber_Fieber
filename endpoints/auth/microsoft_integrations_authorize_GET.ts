import { getServerUserSession } from "../../helpers/getServerUserSession";
import { handleMicrosoftAuthorize } from "@floot/microsoft-integrations";

export async function handle(request: Request): Promise<Response> {
  try {
    await getServerUserSession(request);
  } catch {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return handleMicrosoftAuthorize(request);
}
