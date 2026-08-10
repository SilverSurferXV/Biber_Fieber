import { schema, OutputType } from "./save_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { upload } from "@floot/storage";

function sanitizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\-_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
}

async function uploadPdfFromDataUri(dataUri: string, title: string): Promise<string> {
  // Parse data URI: data:<mediatype>[;base64],<data>
  const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Ungültiges Daten-URI-Format für PDF");
  }
  const base64Data = matches[1]; // e.g. application/pdf
  const base64Content = matches[2];

  const binaryString = atob(base64Content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const sanitized = sanitizeTitle(title) || "datei";
  const filename = `sonderbereich/${sanitized}.pdf`;

  const uploadResult = await upload({
    visibility: "public",
    filename,
    contentType: "application/pdf",
    sizeBytes: bytes.byteLength,
  });

  if (!uploadResult.ok) {
    throw new Error(`Fehler beim Erstellen des Upload-URLs: ${uploadResult.error.message}`);
  }

  const putResponse = await fetch(uploadResult.presignedUrl, {
    method: "PUT",
    body: bytes,
    headers: {
      "Content-Type": "application/pdf",
    },
  });

  if (!putResponse.ok) {
    throw new Error(`Fehler beim Hochladen der Datei: ${putResponse.statusText}`);
  }

  console.log(`Sonderbereich PDF uploaded: ${uploadResult.url}`);
  return uploadResult.url;
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") throw new Error("Forbidden");
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    let pdfUrl = input.pdfUrl;

    // If the pdfUrl is a data URI, upload to storage and use the resulting URL
    if (pdfUrl.startsWith("data:")) {
      pdfUrl = await uploadPdfFromDataUri(pdfUrl, input.title);
    }

    const values = {
      title: input.title,
      description: input.description,
      pdfUrl,
      fileSize: input.fileSize ?? null,
      active: input.active,
    };

    if (input.id) {
      await db.updateTable("sonderbereichFiles").set(values).where("id", "=", input.id).execute();
    } else {
      await db.insertInto("sonderbereichFiles").values(values).execute();
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return new Response(superjson.stringify({ error: message }), { status: message === "Forbidden" ? 403 : 400 });
  }
}