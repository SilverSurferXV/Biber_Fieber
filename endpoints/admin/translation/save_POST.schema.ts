import { z } from "zod";
import superjson from "superjson";
import { enabledLanguagesSchema } from "../translation_GET.schema";

export const schema = z.object({
  enabledLanguages: enabledLanguagesSchema,
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { success: boolean };

export const postAdminTranslationSave = async (
  input: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/translation/save`, {
    method: "POST",
    body: superjson.stringify(input),
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