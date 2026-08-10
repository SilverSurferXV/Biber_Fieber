import { OutputType, DriverCreditNoteItem, DetailData } from "./credit-notes_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "driver") {
      return new Response(
        superjson.stringify({ error: "Unauthorized. Driver access required." }),
        { status: 403 }
      );
    }

    const records = await db
      .selectFrom("driverCreditNotes")
      .select([
        "id",
        "gutschriftNumber",
        "blockStart",
        "blockEnd",
        "stopCompensation",
        "packagingCompensation",
        "totalStopEarnings",
        "totalPackagingEarnings",
        "totalAmount",
        "vatAmount",
        "status",
        "approvedAt",
        "expiresAt",
        "createdAt",
        "detailData",
      ])
      .where("driverId", "=", user.id)
      .orderBy("createdAt", "desc")
      .execute();

    const output: OutputType = records.map((record) => ({
      id: record.id,
      gutschriftNumber: record.gutschriftNumber,
      blockStart: new Date(record.blockStart),
      blockEnd: new Date(record.blockEnd),
      stopCompensation: parseFloat(String(record.stopCompensation)),
      packagingCompensation: parseFloat(String(record.packagingCompensation)),
      totalStopEarnings: parseFloat(String(record.totalStopEarnings)),
      totalPackagingEarnings: parseFloat(String(record.totalPackagingEarnings)),
      totalAmount: parseFloat(String(record.totalAmount)),
      vatAmount: record.vatAmount !== null ? parseFloat(String(record.vatAmount)) : null,
      status: record.status,
      approvedAt: record.approvedAt ? new Date(record.approvedAt) : null,
      expiresAt: new Date(record.expiresAt),
      createdAt: new Date(record.createdAt),
            detailData: record.detailData ? (typeof record.detailData === "string" ? JSON.parse(record.detailData) as DetailData : record.detailData as DetailData) : null,
    } satisfies DriverCreditNoteItem));

    return new Response(superjson.stringify(output));
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}