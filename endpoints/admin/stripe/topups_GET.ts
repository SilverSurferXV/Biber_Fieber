import superjson from "superjson";
import { OutputType } from "./topups_GET.schema";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { db } from "../../../helpers/db";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    if (user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const records = await db
      .selectFrom("walletTopups")
      .leftJoin("users", "users.id", "walletTopups.customerId")
      .select([
        "walletTopups.id",
        "users.firstName",
        "users.lastName",
        "users.email",
        "walletTopups.amount",
        "walletTopups.bonusPercent",
        "walletTopups.pointsCredited",
        "walletTopups.paymentMethod",
        "walletTopups.topupDate"
      ])
      .orderBy("walletTopups.topupDate", "desc")
      .limit(20)
      .execute();

    const formattedRecords = records.map(r => ({
      id: r.id,
      firstName: r.firstName ?? null,
      lastName: r.lastName ?? null,
      email: r.email ?? null,
      amount: Number(r.amount),
      bonusPercent: r.bonusPercent != null ? Number(r.bonusPercent) : null,
      pointsCredited: Number(r.pointsCredited),
      paymentMethod: r.paymentMethod ?? null,
      topupDate: r.topupDate ? new Date(r.topupDate) : null,
    }));

    return new Response(
      superjson.stringify(formattedRecords satisfies OutputType)
    );
  } catch (error: any) {
    if (error.name === "NotAuthenticatedError") {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    return new Response(superjson.stringify({ error: error.message }), { status: 400 });
  }
}