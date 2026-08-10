import { schema, OutputType } from "./save_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { isBase64DataUrl, processProductImage } from "../../../helpers/imageOptimizer";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") throw new Error("Forbidden");
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const now = new Date();

    // Process photo if it's a base64 data URL
    let photoUrl: string | null = input.photoUrl;
    let thumbnailUrl: string | null = null;

    if (photoUrl && isBase64DataUrl(photoUrl)) {
      const imageResult = await processProductImage(photoUrl);
      photoUrl = imageResult.photoUrl;
      thumbnailUrl = imageResult.thumbnailUrl;
    }

    if (input.id) {
      // Fetch existing product to determine if isNew status changed, and existing thumbnailUrl if photo wasn't changed
      const existing = await db
        .selectFrom("products")
        .select(["isNew", "newMarkedAt", "thumbnailUrl"])
        .where("id", "=", input.id)
        .executeTakeFirst();

      // If photoUrl was not a base64 data URL (already a CDN URL), preserve existing thumbnail
      if (!thumbnailUrl) {
        thumbnailUrl = existing?.thumbnailUrl ?? null;
      }

      const wasNew = existing?.isNew ?? false;
      let newMarkedAt: Date | null;

      if (!input.isNew) {
        newMarkedAt = null;
      } else if (wasNew) {
        // Keep existing newMarkedAt if already marked as new
        newMarkedAt = existing?.newMarkedAt ?? now;
      } else {
        // Changed from false -> true
        newMarkedAt = now;
      }

      const values = {
        name: input.name,
        articleNumber: input.articleNumber,
        categoryId: input.categoryId,
        description: input.description,
        externalUrl: input.externalUrl,
        photoUrl,
        thumbnailUrl,
        priceNet: input.priceNet.toString(),
        priceNet2: input.priceNet2 != null ? input.priceNet2.toString() : null,
        priceNet3: input.priceNet3 != null ? input.priceNet3.toString() : null,
        taxRate: input.taxRate?.toString(),
        costPriceEuro: input.costPriceEuro?.toString(),
        costPriceEuro2: input.costPriceEuro2 != null ? input.costPriceEuro2.toString() : null,
        costPriceEuro3: input.costPriceEuro3 != null ? input.costPriceEuro3.toString() : null,
        costPricePercent: input.costPricePercent?.toString(),
        active: input.active,
        isNew: input.isNew,
        supplier: input.supplier,
        sortOrder: input.sortOrder,
        quantityDiscounts: input.quantityDiscounts,
        newDurationDays: input.isNew ? input.newDurationDays : null,
        newMarkedAt,
        weight: input.weight,
        originalPhotoSizeBytes: input.originalPhotoSizeBytes,
        compressedPhotoSizeBytes: input.compressedPhotoSizeBytes,
        isVegan: input.isVegan,
        isBio: input.isBio,
        isGlutenFree: input.isGlutenFree,
        isVegetarian: input.isVegetarian,
        updatedAt: now,
      };

      await db.updateTable("products").set(values).where("id", "=", input.id).execute();
    } else {
      const values = {
        name: input.name,
        articleNumber: input.articleNumber,
        categoryId: input.categoryId,
        description: input.description,
        externalUrl: input.externalUrl,
        photoUrl,
        thumbnailUrl,
        priceNet: input.priceNet.toString(),
        priceNet2: input.priceNet2 != null ? input.priceNet2.toString() : null,
        priceNet3: input.priceNet3 != null ? input.priceNet3.toString() : null,
        taxRate: input.taxRate?.toString(),
        costPriceEuro: input.costPriceEuro?.toString(),
        costPriceEuro2: input.costPriceEuro2 != null ? input.costPriceEuro2.toString() : null,
        costPriceEuro3: input.costPriceEuro3 != null ? input.costPriceEuro3.toString() : null,
        costPricePercent: input.costPricePercent?.toString(),
        active: input.active,
        isNew: input.isNew,
        supplier: input.supplier,
        sortOrder: input.sortOrder,
        quantityDiscounts: input.quantityDiscounts,
        newDurationDays: input.isNew ? input.newDurationDays : null,
        newMarkedAt: input.isNew ? now : null,
        weight: input.weight,
        originalPhotoSizeBytes: input.originalPhotoSizeBytes,
        compressedPhotoSizeBytes: input.compressedPhotoSizeBytes,
        isVegan: input.isVegan,
        isBio: input.isBio,
        isGlutenFree: input.isGlutenFree,
        isVegetarian: input.isVegetarian,
        updatedAt: now,
      };

      await db.insertInto("products").values(values).execute();
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: error.message === "Forbidden" ? 403 : 400 });
  }
}