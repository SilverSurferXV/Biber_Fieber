import { z } from "zod";
import { User } from "../../helpers/User";
import superjson from "superjson";

export const schema = z.object({
  salutation: z.enum(["Herr", "Frau", "Herr Dr.", "Frau Dr.", "Firma"]),
  email: z.string().email("Email ist erforderlich"),
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen lang sein"),
  firstName: z.string().min(1, "Vorname ist erforderlich"),
  lastName: z.string().min(1, "Nachname ist erforderlich"),
  postcode: z.string().min(1, "Postleitzahl ist erforderlich"),
  city: z.string().min(1, "Stadt ist erforderlich"),
  streetAddress: z.string().min(1, "Straße und Hausnummer ist erforderlich"),
  mobileNumber: z.string().min(1, "Handynummer ist erforderlich"),
  referralCode: z.string().optional(),
  dateOfBirth: z.string().optional(),
  companyName: z.string().optional(),
});

export type OutputType = {
  user: User;
};

export const postRegister = async (
  body: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/auth/register_with_password`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include", // Important for cookies to be sent and received
  });

  if (!result.ok) {
    const errorData = superjson.parse<{ message: string }>(await result.text());
    throw new Error(errorData.message || "Registration failed");
  }

  return superjson.parse<OutputType>(await result.text());
};