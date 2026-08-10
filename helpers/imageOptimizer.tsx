import sharp from "sharp";
import { upload } from "@floot/storage";
import crypto from "crypto";

/**
 * Returns true if the url starts with "data:"
 */
export function isBase64DataUrl(url: string): boolean {
  return url.startsWith("data:");
}

/**
 * Processes a base64 data URL string into an optimized full-size JPEG and a thumbnail JPEG.
 * Uploads both to Floot storage and returns the CDN URLs.
 */
export async function processProductImage(
  base64DataUrl: string
): Promise<{ photoUrl: string; thumbnailUrl: string }> {
  if (!isBase64DataUrl(base64DataUrl)) {
    throw new Error("Provided URL is not a base64 data URL");
  }

  // Extract the base64 payload from the data URL
  const parts = base64DataUrl.split(",");
  if (parts.length !== 2) {
    throw new Error("Invalid base64 data format");
  }
  
  const base64Data = parts[1];
  const imageBuffer = Buffer.from(base64Data, "base64");

  // 1. Create a full-size optimized version (max 1200px, quality 80)
  const fullImageBuffer = await sharp(imageBuffer)
    .resize({
      width: 1200,
      height: 1200,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer();

  // 2. Create a thumbnail (max 400px width, quality 60)
  const thumbnailBuffer = await sharp(imageBuffer)
    .resize({
      width: 400,
      withoutEnlargement: true,
    })
    .jpeg({ quality: 60 })
    .toBuffer();

  const uniqueId = crypto.randomUUID();

  // 3. Upload Full Image
  const fullUpload = await upload({
    visibility: "public",
    filename: `products/full-${uniqueId}.jpg`,
    contentType: "image/jpeg",
    sizeBytes: fullImageBuffer.length,
  });

  if (!fullUpload.ok) {
    throw new Error(`Failed to initialize full image upload: ${fullUpload.error.message}`);
  }

  const fullPutResponse = await fetch(fullUpload.presignedUrl, {
    method: "PUT",
    body: fullImageBuffer,
    headers: {
      "Content-Type": "image/jpeg",
    },
  });

  if (!fullPutResponse.ok) {
    throw new Error(`Failed to write full image to storage: ${fullPutResponse.statusText}`);
  }

  // 4. Upload Thumbnail Image
  const thumbUpload = await upload({
    visibility: "public",
    filename: `products/thumb-${uniqueId}.jpg`,
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

  return {
    photoUrl: fullUpload.url,
    thumbnailUrl: thumbUpload.url,
  };
}