import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type EmailTemplate = {
  id: number;
  slug: string;
  name: string;
  subject: string;
  htmlBody: string;
  availableVariables: string[];
  description: string | null;
  updatedAt: Date | null;
};

export type OutputType = {
  templates: EmailTemplate[];
};

export const getEmailTemplates = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/email-templates`, {
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