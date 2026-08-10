import { schema, OutputType } from "./approve_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "driver") {
      return new Response(
        superjson.stringify({ error: "Unauthorized. Driver access required." }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const data = schema.parse(json);

    // Verify ownership and status
    const creditNote = await db
      .selectFrom("driverCreditNotes")
      .select(["id", "status"])
      .where("id", "=", data.creditNoteId)
      .where("driverId", "=", user.id)
      .executeTakeFirst();

    if (!creditNote) {
      return new Response(
        superjson.stringify({ error: "Credit note not found or access denied." }),
        { status: 404 }
      );
    }

    if (creditNote.status !== "pending") {
      return new Response(
        superjson.stringify({ error: `Cannot approve credit note with status: ${creditNote.status}` }),
        { status: 400 }
      );
    }

    await db
      .updateTable("driverCreditNotes")
      .set({
        status: "approved_manual",
        approvedAt: new Date(),
      })
      .where("id", "=", data.creditNoteId)
      .execute();

    return new Response(
      superjson.stringify({
        success: true,
        status: "approved_manual",
      } satisfies OutputType)
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}