import { OutputType } from "./product-ranking_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { sql } from "kysely";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") throw new Error("Forbidden");

    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate") ?? null;
    const endDate = url.searchParams.get("endDate") ?? null;

    console.log("product-ranking_GET: startDate=", startDate, "endDate=", endDate);

    // Build the date filter conditions dynamically
    const startDateCondition = startDate
      ? sql`AND o.order_date >= ${startDate}::date`
      : sql``;
    const endDateCondition = endDate
      ? sql`AND o.order_date < (${endDate}::date + interval '1 day')`
      : sql``;

    const result = await sql<{
      productId: number;
      name: string;
      articleNumber: string;
      photoUrl: string | null;
      active: boolean | null;
      categoryName: string | null;
      totalSold: string;
      totalRevenue: string;
    }>`
      SELECT 
        p.id as product_id,
        p.name,
        p.article_number,
        p.photo_url,
        p.active,
        pc.name as category_name,
        COALESCE(sales.total_sold, 0) as total_sold,
        COALESCE(sales.total_revenue, 0) as total_revenue
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      LEFT JOIN (
        SELECT 
          oi.product_id,
          SUM(oi.quantity) as total_sold,
          SUM(oi.quantity * oi.unit_price * (1 + COALESCE(oi.tax_rate, 0) / 100)) as total_revenue
        FROM order_items oi
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE o.status != 'cancelled'
        ${startDateCondition}
        ${endDateCondition}
        GROUP BY oi.product_id
      ) sales ON p.id = sales.product_id
      ORDER BY sales.total_sold DESC NULLS LAST, p.name ASC
    `.execute(db);

    const output: OutputType = result.rows.map((r, i) => ({
      rank: i + 1,
      productId: r.productId,
      name: r.name,
      articleNumber: r.articleNumber,
      photoUrl: r.photoUrl ?? null,
      categoryName: r.categoryName ?? null,
      totalSold: r.totalSold ? Number(r.totalSold) : 0,
      totalRevenue: r.totalRevenue ? Number(r.totalRevenue) : 0,
      active: r.active ?? false,
    }));

    return new Response(superjson.stringify(output satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("product-ranking_GET error:", error);
    return new Response(superjson.stringify({ error: message }), {
      status: message === "Forbidden" ? 403 : 400,
    });
  }
}