import { schema, OutputType } from "./migrate-images_POST.schema";
import superjson from "superjson";
import sharp from "sharp";
import crypto from "crypto";
import { upload } from "@floot/storage";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { isBase64DataUrl, processProductImage } from "../../helpers/imageOptimizer";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    if (user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Forbidden - Requires admin role." }),
        { status: 403 }
      );
    }

    // Parse the empty schema to ensure JSON consistency
    schema.parse(superjson.parse(await request.text()));

    let migratedCount = 0;
    const errors: string[] = [];
    const BATCH_SIZE = 5;

    // ===== PHASE 1: Migrate base64 data URLs to CDN =====
    const base64Products = await db
      .selectFrom("products")
      .select(["id", "name", "photoUrl"])
      .where("photoUrl", "like", "data:%")
      .execute();

    for (let i = 0; i < base64Products.length; i += BATCH_SIZE) {
      const batch = base64Products.slice(i, i + BATCH_SIZE);
      
      await Promise.all(
        batch.map(async (product) => {
          try {
            console.log(`[Phase 1] Migrating base64 product ${product.id}: ${product.name}`);
            
            if (!product.photoUrl || !isBase64DataUrl(product.photoUrl)) {
              return;
            }

            const { photoUrl, thumbnailUrl } = await processProductImage(
              product.photoUrl
            );

            await db
              .updateTable("products")
              .set({
                photoUrl: photoUrl,
                thumbnailUrl: thumbnailUrl,
                updatedAt: new Date(),
              })
              .where("id", "=", product.id)
              .execute();

            migratedCount++;
          } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[Phase 1] Error migrating product ${product.id}:`, errorMsg);
            errors.push(`[Phase 1 - Product ${product.id}] ${errorMsg}`);
          }
        })
      );
    }

    // ===== PHASE 2: Generate thumbnails for CDN products missing them =====
    const missingThumbProducts = await db
      .selectFrom("products")
      .select(["id", "name", "photoUrl"])
      .where("thumbnailUrl", "is", null)
      .where("photoUrl", "is not", null)
      .where("photoUrl", "not like", "data:%")
      .execute();

    for (let i = 0; i < missingThumbProducts.length; i += BATCH_SIZE) {
      const batch = missingThumbProducts.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (product) => {
          try {
            console.log(`[Phase 2] Generating thumbnail for product ${product.id}: ${product.name}`);

            if (!product.photoUrl) {
              return;
            }

            // Download the existing CDN image
            const imageResponse = await fetch(product.photoUrl);
            if (!imageResponse.ok) {
              throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
            }

            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

            // Create a thumbnail (400px width, quality 60, JPEG)
            const thumbnailBuffer = await sharp(imageBuffer)
              .resize({
                width: 400,
                withoutEnlargement: true,
              })
              .jpeg({ quality: 60 })
              .toBuffer();

            const uniqueId = crypto.randomUUID();
            const thumbnailFilename = `products/thumb-${uniqueId}.jpg`;

            // Upload the thumbnail to Floot storage
            const thumbUpload = await upload({
              visibility: "public",
              filename: thumbnailFilename,
              contentType: "image/jpeg",
              sizeBytes: thumbnailBuffer.length,
            });

            if (!thumbUpload.ok) {
              throw new Error(`Failed to initialize thumbnail upload: ${thumbUpload.error.message}`);
            }

            const thumbPutResponse = await fetch(thumbUpload.presignedUrl, {
              method: "PUT",
              body: thumbnailBuffer,
              headers: {
                "Content-Type": "image/jpeg",
              },
            });

            if (!thumbPutResponse.ok) {
              throw new Error(`Failed to write thumbnail to storage: ${thumbPutResponse.statusText}`);
            }

            // Update the DB with the thumbnail URL
            await db
              .updateTable("products")
              .set({
                thumbnailUrl: thumbUpload.url,
                updatedAt: new Date(),
              })
              .where("id", "=", product.id)
              .execute();

            migratedCount++;
          } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[Phase 2] Error generating thumbnail for product ${product.id}:`, errorMsg);
            errors.push(`[Phase 2 - Product ${product.id}] ${errorMsg}`);
          }
        })
      );
    }

    return new Response(
      superjson.stringify({
        success: true,
        migrated: migratedCount,
        errors,
      } satisfies OutputType)
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: message }),
      { status: error instanceof Error && error.message.includes("Not authenticated") ? 401 : 500 }
    );
  }
}