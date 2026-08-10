import type { PagePrefetchFn } from "@floot/prefetch";
import { db } from "../helpers/db";
import { getServerUserSession } from "../helpers/getServerUserSession";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const request = ctx.getRequest();
  const { qc } = ctx;

    let userSession: Awaited<ReturnType<typeof getServerUserSession>>;
  try {
    userSession = await getServerUserSession(request);
    await qc.prefetchQuery({
      queryKey: ["auth", "session"],
      queryFn: () => userSession.user,
    });
  } catch (error) {
    // Auth failed, do not prefetch admin queries since user is unauthenticated
    return;
  }

  if (userSession.user.role !== "admin") {
    // Not an admin, skip admin queries
    return;
  }

  // Admin products
  try {
    await qc.prefetchQuery({
      queryKey: ["admin", "products", undefined, undefined],
      queryFn: async () => {
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
          .limit(200)
          .offset(0)
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
        return {
          products,
          totalCount,
          page: 1,
          totalPages: Math.ceil(totalCount / 200),
        };
      },
    });
  } catch (err) {
    console.error("Prefetch admin products failed", err);
  }

  // Admin categories
  try {
    await qc.prefetchQuery({
      queryKey: ["admin", "categories"],
      queryFn: async () => {
        const categories = await db
          .selectFrom("productCategories")
          .selectAll()
          .orderBy("sortOrder", "asc")
          .execute();
        return categories;
      },
    });
  } catch (err) {
    console.error("Prefetch admin categories failed", err);
  }

  // Shop settings
  try {
    await qc.prefetchQuery({
      queryKey: ["shop", "settings"],
      queryFn: async () => {
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
          freeDeliveryThreshold: settings.freeDeliveryThreshold ? Number(settings.freeDeliveryThreshold) : null,
        };
      },
    });
  } catch (err) {
    console.error("Prefetch shop settings failed", err);
  }
};