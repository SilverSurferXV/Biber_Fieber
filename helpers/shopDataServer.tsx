import { sql } from "kysely";
import { db } from "./db";

/**
 * Retrieves the application settings from the database and parses
 * numeric values correctly.
 */
export async function getSettingsFromDb() {
  const settings = await db
    .selectFrom("appSettings")
    .selectAll()
    .limit(1)
    .executeTakeFirst();

  if (!settings) {
    throw new Error("Settings not found");
  }

  return {
    ...settings,
    shopLatitude: settings.shopLatitude ? Number(settings.shopLatitude) : null,
    shopLongitude: settings.shopLongitude ? Number(settings.shopLongitude) : null,
    freeDeliveryThreshold: settings.freeDeliveryThreshold
      ? Number(settings.freeDeliveryThreshold)
      : null,
    deliveryFee: settings.deliveryFee ? Number(settings.deliveryFee) : null,
  };
}

/**
 * Retrieves all active product categories from the database, ordered by sortOrder.
 */
export async function getCategoriesFromDb() {
  return await db
    .selectFrom("productCategories")
    .selectAll()
    .where("active", "=", true)
    .orderBy("sortOrder", "asc")
    .execute();
}

/**
 * Retrieves active products from the database, optionally filtered by category.
 * Joins with categories and calculates average review scores.
 * Parses all necessary numeric values correctly.
 */
export async function getProductsFromDb(categoryId?: number) {
  let query = db
    .selectFrom("products")
    .leftJoin(
      "productCategories",
      "products.categoryId",
      "productCategories.id"
    )
    .select([
      "products.id",
      "products.articleNumber",
      "products.name",
      "products.categoryId",
      "products.description",
      "products.externalUrl",
      "products.photoUrl",
      "products.thumbnailUrl",
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
      (eb) =>
        eb
          .selectFrom("reviews")
          .select(sql<number>`avg(star_rating)`.as("avg"))
          .whereRef("reviews.productId", "=", "products.id")
          .as("averageRating"),
    ])
    .where("products.active", "=", true);

  if (categoryId !== undefined) {
    query = query.where("products.categoryId", "=", categoryId);
  }

  const rows = await query.orderBy("products.sortOrder", "asc").execute();

  return rows.map((r) => ({
    ...r,
    priceNet: Number(r.priceNet),
    priceNet2: r.priceNet2 ? Number(r.priceNet2) : null,
    priceNet3: r.priceNet3 ? Number(r.priceNet3) : null,
    taxRate: r.taxRate ? Number(r.taxRate) : null,
    costPriceEuro: r.costPriceEuro ? Number(r.costPriceEuro) : null,
    costPriceEuro2: r.costPriceEuro2 ? Number(r.costPriceEuro2) : null,
    costPriceEuro3: r.costPriceEuro3 ? Number(r.costPriceEuro3) : null,
    costPricePercent: r.costPricePercent ? Number(r.costPricePercent) : null,
    averageRating: r.averageRating ? Number(r.averageRating) : null,
    categoryName: r.categoryName ?? null,
    thumbnailUrl: r.thumbnailUrl ?? null,
  }));
}