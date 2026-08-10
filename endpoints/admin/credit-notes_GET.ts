import { OutputType, AdminCreditNoteItem } from "./credit-notes_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized. Admin access required." }),
        { status: 403 }
      );
    }

    const searchParams = new URL(request.url).searchParams;
    const driverIdParam = searchParams.get("driverId");
    
    let query = db
      .selectFrom("driverCreditNotes")
      .innerJoin("users", "users.id", "driverCreditNotes.driverId")
      .select([
        "driverCreditNotes.id",
        "driverCreditNotes.driverId",
        "users.displayName as driverName",
        "driverCreditNotes.gutschriftNumber",
        "driverCreditNotes.blockStart",
        "driverCreditNotes.blockEnd",
        "driverCreditNotes.totalAmount",
        "driverCreditNotes.vatAmount",
        "driverCreditNotes.status",
        "driverCreditNotes.approvedAt",
        "driverCreditNotes.expiresAt",
        "driverCreditNotes.createdAt",
      ])
      .orderBy("driverCreditNotes.createdAt", "desc");

    if (driverIdParam) {
      query = query.where("driverCreditNotes.driverId", "=", parseInt(driverIdParam, 10));
    }

    const records = await query.execute();

    const output: OutputType = records.map((record) => ({
      id: record.id,
      driverId: record.driverId,
      driverName: record.driverName,
      gutschriftNumber: record.gutschriftNumber,
      blockStart: new Date(record.blockStart),
      blockEnd: new Date(record.blockEnd),
      totalAmount: parseFloat(String(record.totalAmount)),
      vatAmount: record.vatAmount !== null ? parseFloat(String(record.vatAmount)) : null,
      status: record.status,
      approvedAt: record.approvedAt ? new Date(record.approvedAt) : null,
      expiresAt: new Date(record.expiresAt),
      createdAt: new Date(record.createdAt),
    } satisfies AdminCreditNoteItem));

    return new Response(superjson.stringify(output));
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}