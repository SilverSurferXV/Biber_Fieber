import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { OutputType } from "./product-ratings_GET.schema";
import superjson from 'superjson';

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    if (user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    // Aggregate ratings using Kysely
    const rows = await db.selectFrom("productRatings")
      .innerJoin("products", "products.id", "productRatings.productId")
      .select(({ fn }) => [
        "products.id as productId",
        "products.name as productName",
        "products.articleNumber",
        fn.avg("productRatings.tasteRating").as("avgTaste"),
        fn.avg("productRatings.qualityRating").as("avgQuality"),
        fn.avg("productRatings.priceRating").as("avgPrice"),
        fn.count<number>("productRatings.id").as("totalRatings")
      ])
      .groupBy(["products.id", "products.name", "products.articleNumber"])
      .orderBy("products.name", "asc")
      .execute();

    const output: OutputType = rows.map(r => ({
      productId: r.productId,
      productName: r.productName,
      articleNumber: r.articleNumber,
      avgTaste: Number(r.avgTaste) || 0,
      avgQuality: Number(r.avgQuality) || 0,
      avgPrice: Number(r.avgPrice) || 0,
      totalRatings: Number(r.totalRatings) || 0
    }));

    return new Response(superjson.stringify(output satisfies OutputType));
  } catch (error) {
    const err = error as Error;
    return new Response(superjson.stringify({ error: err.message }), { status: 400 });
  }
}