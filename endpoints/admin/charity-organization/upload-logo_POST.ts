import { schema, OutputType } from "./upload-logo_POST.schema";
import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { upload } from "@floot/storage";
import { nanoid } from "nanoid";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    // Ensure the user is an admin
    if (user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Forbidden: Admins only" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const result = schema.parse(json);

    // Create a unique filename to prevent collisions
    const filename = `charity-logos/${nanoid()}-${result.filename}`;

    const uploadResult = await upload({
      visibility: "public",
      filename,
      contentType: result.contentType,
      sizeBytes: result.sizeBytes,
    });

    if (!uploadResult.ok) {
      throw new Error(`Failed to initialize upload: ${uploadResult.error.message}`);
    }

    return new Response(
      superjson.stringify({
        url: uploadResult.url,
        presignedUrl: uploadResult.presignedUrl,
      } satisfies OutputType)
    );
  } catch (error) {
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      { status: 400 }
    );
  }
}