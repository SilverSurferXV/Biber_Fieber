import { schema } from "./client-error_POST.schema";
import superjson from "superjson";
import { requestClientInfo } from "../../helpers/requestClientInfo";

export async function handle(request: Request) {
  try {
    const text = await request.text();
    let payload: unknown;

    try {
      payload = JSON.parse(text);
    } catch {
      payload = { 
        message: "Raw text payload (parse failed)", 
        bodySnippet: text.substring(0, 500) 
      };
    }

     const parsed = schema.safeParse(payload);
     const data = parsed.success ? parsed.data : payload;
     const { ipAddress, userAgent } = requestClientInfo(request);
    
    const logBase = typeof data === "object" && data !== null ? data : { data };
    const { context, ...rest } = logBase as Record<string, unknown>;
 
     console.error("[client-diagnostic]", {
      ...rest,
       ...(typeof data === "object" && data !== null ? data : { data }),
       serverIpHeader: ipAddress,
       serverUserAgentHeader: userAgent,
      contextJson: context ? JSON.stringify(context) : undefined,
    });

    return new Response(superjson.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (err) {
    console.error("[client-diagnostic] failed to process", err);
    // Return 200 regardless so beacon finishes quietly without spamming browser console
    return new Response(superjson.stringify({ success: false }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}