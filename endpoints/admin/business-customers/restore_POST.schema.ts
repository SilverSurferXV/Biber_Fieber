import { z } from "zod";

export const schema = z.object({
  version: z.number(),
  data: z.any(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  restoredUsers: number;
};

// Allows passing the parsed JSON object directly or a raw File from an input upload
export const postAdminBusinessCustomersRestore = async (
  input: InputType | File,
  init?: RequestInit
): Promise<OutputType> => {
  let bodyString: string;
  
  if (input instanceof File) {
    bodyString = await input.text();
  } else {
    bodyString = JSON.stringify(input);
  }

  const result = await fetch(`/_api/admin/business-customers/restore`, {
    method: "POST",
    body: bodyString,
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  
  if (!result.ok) {
    const errorText = await result.text();
    let errorMessage = errorText;
    try {
      errorMessage = JSON.parse(errorText).error;
    } catch {}
    throw new Error(errorMessage || result.statusText);
  }
  
  return JSON.parse(await result.text());
};