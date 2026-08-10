import { schema, OutputType } from "./point-history_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    // Parse to ensure standard input format, though empty for GET
    schema.parse({});

    const transactions = await db
      .selectFrom("pointTransactions")
      .selectAll()
      .where("customerId", "=", user.id)
      .orderBy("createdAt", "desc")
      .execute();

    const output: OutputType = {
      transactions: transactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
        createdAt: t.createdAt ? new Date(t.createdAt) : new Date(0),
      })),
    };

    return new Response(superjson.stringify(output satisfies OutputType));
  } catch (error: any) {
    return new Response(
      superjson.stringify({ error: error.message }),
      { status: error.name === "NotAuthenticatedError" ? 401 : 400 }
    );
  }
}