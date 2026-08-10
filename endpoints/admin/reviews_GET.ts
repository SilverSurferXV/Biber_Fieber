import { schema, OutputType } from "./reviews_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") throw new Error("Forbidden");
    const input = schema.parse({});

    const reviews = await db
      .selectFrom("reviews")
      .leftJoin("products", "reviews.productId", "products.id")
      .leftJoin("users", "reviews.customerId", "users.id")
      .selectAll("reviews")
      .select(["products.name as productName", "users.displayName as customerName"])
      .orderBy("submittedAt", "desc")
      .execute();

    return new Response(superjson.stringify(reviews satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: error.message === "Forbidden" ? 403 : 400 });
  }
}