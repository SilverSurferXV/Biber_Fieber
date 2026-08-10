import { OutputType } from "./zone-driver-assignments_GET.schema";
import superjson from "superjson";
import { db } from '../../helpers/db';
import { getServerUserSession } from '../../helpers/getServerUserSession';

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized. Admin access required." }),
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const dateKeysStr = url.searchParams.get("dateKeys");

    let query = db.selectFrom("zoneDriverAssignments").selectAll();

    if (dateKeysStr) {
      const keysArray = dateKeysStr.
      split(",").
      map((k) => k.trim()).
      filter((k) => k.length > 0);
      if (keysArray.length > 0) {
        query = query.where("dateKey", "in", keysArray);
      }
    }

    const assignments = await query.execute();

    return new Response(superjson.stringify(assignments satisfies OutputType));
  } catch (error: unknown) {
    const errorMessage =
    error instanceof Error ? error.message : "Internal Server Error";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400
    });
  }
}