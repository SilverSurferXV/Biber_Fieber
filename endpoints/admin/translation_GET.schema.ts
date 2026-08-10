import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export const enabledLanguagesSchema = z.object({
  en: z.boolean(),
  es: z.boolean(),
  it: z.boolean(),
  tr: z.boolean(),
});

export type EnabledLanguagesType = z.infer<typeof enabledLanguagesSchema>;

export type OutputType = {
  enabledLanguages: EnabledLanguagesType;
};

export const getAdminTranslation = async (
  input: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/translation`, {
    method: "GET",
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