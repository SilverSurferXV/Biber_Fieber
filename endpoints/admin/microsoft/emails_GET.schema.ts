import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type MicrosoftEmailMessage = {
  id: string;
  subject: string;
  from?: {
    emailAddress: {
      address: string;
      name: string;
    };
  };
  receivedDateTime: string;
  bodyPreview: string;
  isRead: boolean;
  hasAttachments: boolean;
  body?: {
    contentType: string;
    content: string;
  };
  categories?: string[];
};

export type OutputType = MicrosoftEmailMessage[];

export const getMicrosoftEmails = async (
  input: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/microsoft/emails`, {
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