import { schema, OutputType } from "./apply-bibercode_POST.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    const json = superjson.parse(await request.text());
    const result = schema.parse(json);
    const inputCode = result.code.trim();

    // Check if the current user already has a referredByBibercode
    const currentUser = await db
      .selectFrom("users")
      .select(["referredByBibercode", "bibercode"])
      .where("id", "=", user.id)
      .executeTakeFirstOrThrow();

    if (currentUser.referredByBibercode) {
      return new Response(
        superjson.stringify({ error: "Du hast bereits einen Biber-Code hinterlegt." }),
        { status: 400 }
      );
    }

    if (currentUser.bibercode && currentUser.bibercode.toLowerCase() === inputCode.toLowerCase()) {
      return new Response(
        superjson.stringify({ error: "Du kannst nicht deinen eigenen Biber-Code verwenden." }),
        { status: 400 }
      );
    }

    // Validate the code by looking up the referrer
    const referrerUser = await db
      .selectFrom("users")
      .select(["id", "firstName", "lastName", "bibercode", "referredByBibercode"])
      .where("bibercode", "ilike", inputCode)
      .executeTakeFirst();

    if (!referrerUser || !referrerUser.bibercode) {
      return new Response(
        superjson.stringify({ error: "Ungültiger Biber-Code." }),
        { status: 400 }
      );
    }

    // Check if the referrer has reached the maximum number of referrals
    const referralCount = await db
      .selectFrom("users")
      .select(db.fn.countAll().as("count"))
      .where("referredByBibercode", "ilike", referrerUser.bibercode)
      .executeTakeFirstOrThrow();

    if (Number(referralCount.count) >= 20) {
      return new Response(
        superjson.stringify({ error: "Dieser Nutzer hat bereits die maximale Anzahl von 20 Biber-Freunden erreicht." }),
        { status: 400 }
      );
    }

    // Circular referral check: prevent mutual referrals
    if (
      currentUser.bibercode &&
      referrerUser.referredByBibercode &&
      currentUser.bibercode.toLowerCase() === referrerUser.referredByBibercode.toLowerCase()
    ) {
      return new Response(
        superjson.stringify({ error: "Gegenseitiges Empfehlen ist nicht erlaubt. Dieser Nutzer hat bereits deinen Biber-Code verwendet." }),
        { status: 400 }
      );
    }

    // Update the current user's referredByBibercode using the exact casing of the referrer's code
    await db
      .updateTable("users")
      .set({ referredByBibercode: referrerUser.bibercode })
      .where("id", "=", user.id)
      .execute();

    const firstName = referrerUser.firstName || "Nutzer";
    const lastInitial = referrerUser.lastName ? `${referrerUser.lastName.charAt(0)}.` : "";
    const ownerName = `${firstName} ${lastInitial}`.trim();

    return new Response(
      superjson.stringify({ success: true, ownerName } satisfies OutputType)
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten.";
    return new Response(
      superjson.stringify({ error: errorMessage }),
      { status: 400 }
    );
  }
}