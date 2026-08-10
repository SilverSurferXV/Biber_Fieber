import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type SenderRecord = {
  email: string;
  status: string;
  createdAt: Date | null;
};

export type MessageRecord = {
  id: number;
  status: string;
  subject: string;
  sentAt: Date | null;
  to: string;
  from: string;
};

export type OutputType = {
  connected: boolean;
  error?: string;
  maskedApiKey: string;
  senders: SenderRecord[];
  recentMessages: MessageRecord[];
};

export const getMailjetStatus = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/mailjet/status`, {
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