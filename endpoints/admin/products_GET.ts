import { schema, OutputType } from "./products_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") throw new Error("Forbidden");

    const url = new URL(request.url);
    const input = schema.parse({
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    const [{ total }] = await db
      .selectFrom("products")
      .select(db.fn.countAll().as("total"))
      .execute();

    const rows = await db
      .selectFrom("products")
      .leftJoin("productCategories", "products.categoryId", "productCategories.id")
      .leftJoin("reviews", "products.id", "reviews.productId")
      .select([
        "products.id",
        "products.articleNumber",
        "products.name",
        "products.categoryId",
        "products.description",
        "products.externalUrl",
        "products.photoUrl",
        "products.priceNet",
        "products.priceNet2",
        "products.priceNet3",
        "products.taxRate",
        "products.costPriceEuro",
        "products.costPriceEuro2",
        "products.costPriceEuro3",
        "products.costPricePercent",
        "products.quantityDiscounts",
        "products.active",
        "products.sortOrder",
        "products.originalPhotoSizeBytes",
        "products.compressedPhotoSizeBytes",
        "products.isNew",
        "products.newDurationDays",
        "products.newMarkedAt",
        "products.createdAt",
        "products.updatedAt",
        "products.supplier",
        "products.weight",
        "products.isVegan",
        "products.isBio",
        "products.isGlutenFree",
        "products.isVegetarian",
        "productCategories.name as categoryName",
        (eb) => eb.fn.avg("reviews.starRating").as("averageRating"),
      ])
      .groupBy(["products.id", "productCategories.id"])
      .orderBy("products.sortOrder", "asc")
      .limit(input.limit)
      .offset((input.page - 1) * input.limit)
      .execute();

    const products = rows.map((r) => ({
      ...r,
      priceNet: Number(r.priceNet),
      priceNet2: r.priceNet2 ? Number(r.priceNet2) : null,
      priceNet3: r.priceNet3 ? Number(r.priceNet3) : null,
      taxRate: r.taxRate ? Number(r.taxRate) : null,
      costPriceEuro: r.costPriceEuro ? Number(r.costPriceEuro) : null,
      costPriceEuro2: r.costPriceEuro2 ? Number(r.costPriceEuro2) : null,
      costPriceEuro3: r.costPriceEuro3 ? Number(r.costPriceEuro3) : null,
      costPricePercent: r.costPricePercent ? Number(r.costPricePercent) : null,
      originalPhotoSizeBytes: r.originalPhotoSizeBytes ?? null,
      compressedPhotoSizeBytes: r.compressedPhotoSizeBytes ?? null,
      averageRating: r.averageRating ? Number(r.averageRating) : null,
      categoryName: r.categoryName ?? null,
      weight: r.weight ?? null,
    }));

    const totalCount = Number(total);
    const output = {
      products,
      totalCount,
      page: input.page,
      totalPages: Math.ceil(totalCount / input.limit),
    };

    return new Response(superjson.stringify(output satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(superjson.stringify({ error: message }), {
      status: message === "Forbidden" ? 403 : 400,
    });
  }
}