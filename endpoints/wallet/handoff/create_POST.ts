import { schema, OutputType } from "./create_POST.schema";
import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { profileCompleteness } from "../../../helpers/profileCompleteness";
import { isAdult } from "../../../helpers/isAdult";
import { db } from "../../../helpers/db";
import { nanoid } from "nanoid";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    const profile = await db.selectFrom("users")
      .select(["postcode", "city", "streetAddress", "mobileNumber", "dateOfBirth"])
      .where("id", "=", user.id)
      .executeTakeFirstOrThrow();

    const { isComplete, missingFields } = profileCompleteness(profile);
    if (!isComplete) {
      console.error("Profile incomplete for wallet top-up handoff. Missing fields:", missingFields);
      throw new Error("Bitte vervollständige zuerst deine Daten (PLZ, Stadt, Straße & Hausnummer, Handynummer, Geburtsdatum), um Guthaben aufzuladen.");
    }

    if (!isAdult(profile.dateOfBirth)) {
      throw new Error("Du musst mindestens 18 Jahre alt sein, um bei uns zu bestellen.");
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const now = new Date();

    // Mark previous pending and expired tokens for this customer as expired
    await db.updateTable("topupHandoffTokens")
      .set({ status: "expired" })
      .where("customerId", "=", user.id)
      .where("status", "=", "pending")
      .where("expiresAt", "<", now)
      .execute();

    const token = nanoid(32);
    // Token expires in 30 minutes
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

    await db.insertInto("topupHandoffTokens")
      .values({
        token,
        customerId: user.id,
        amount: input.amount.toString(),
        status: "pending",
        expiresAt,
      })
      .execute();

    const origin = new URL(request.url).origin;

    return new Response(
      superjson.stringify({
        token,
        url: `${origin}/aufladen/${token}`,
        expiresAt,
      } satisfies OutputType)
    );
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), {
      status: error.name === "NotAuthenticatedError" ? 401 : 400,
    });
  }
}