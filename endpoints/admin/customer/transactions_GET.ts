import { schema, OutputType } from "./transactions_GET.schema";
import superjson from "superjson";
import { db } from '../../../helpers/db';
import { getServerUserSession } from '../../../helpers/getServerUserSession';

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") {
      throw new Error("Forbidden");
    }

    const url = new URL(request.url);
    const customerIdRaw = url.searchParams.get("customerId");
    if (!customerIdRaw) {
      throw new Error("customerId is required");
    }

    const input = schema.parse({ customerId: Number(customerIdRaw) });

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const transactions = await db.
    selectFrom("pointTransactions").
    selectAll().
    where("customerId", "=", input.customerId).
    where("createdAt", ">=", threeMonthsAgo).
    orderBy("createdAt", "desc").
    execute();

    const output: OutputType = transactions.map((t) => ({
      ...t,
      amount: Number(t.amount)
    }));

    return new Response(superjson.stringify(output satisfies OutputType));
  } catch (error: any) {
    const status = error.message === "Forbidden" ? 403 : 400;
    return new Response(superjson.stringify({ error: error.message }), { status });
  }
}