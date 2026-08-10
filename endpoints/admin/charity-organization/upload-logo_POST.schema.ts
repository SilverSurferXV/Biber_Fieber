import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  filename: z.string().min(1),
  contentType: z.string().startsWith("image/"),
  sizeBytes: z.number().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  url: string;
  presignedUrl: string;
};

export const postUploadCharityLogo = async (
  body: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/charity-organization/upload-logo`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};