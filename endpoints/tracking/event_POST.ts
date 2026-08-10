import { schema, OutputType } from "./event_POST.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";

export async function handle(request: Request) {
  try {
    const text = await request.text();
let json: unknown;
const raw = JSON.parse(text);
// superjson wraps payloads as { json: ..., meta?: ... }
if (raw && typeof raw === "object" && "json" in raw) {
  json = superjson.parse(text);
} else {
  json = raw;
}
    const input = schema.parse(json);
    
    await db.insertInto("analyticsEvents").values({
      sessionId: input.sessionId,
      eventType: input.eventType,
      pagePath: input.pagePath,
      tabName: input.tabName ?? null,
            durationSeconds: input.durationSeconds != null ? Math.round(input.durationSeconds) : null,
    }).execute();
    
    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Tracking error:", msg);
    return new Response(superjson.stringify({ error: msg }), { status: 400 });
  }
}