import { db } from '../../../helpers/db';
import { schema, OutputType } from "./create_POST.schema";
import { randomBytes } from "crypto";
import { generatePasswordHash } from '../../../helpers/generatePasswordHash';
import { getServerUserSession } from '../../../helpers/getServerUserSession';
import superjson from "superjson";

function generateBibercode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(8);
  let code = "BIBER-";
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

async function generateUniqueBibercode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateBibercode();
    const existing = await db.
    selectFrom("users").
    select("id").
    where("bibercode", "=", code).
    limit(1).
    execute();
    if (existing.length === 0) {
      return code;
    }
  }
  throw new Error("Failed to generate a unique bibercode after 10 attempts.");
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Check email uniqueness
    const existingUser = await db.
    selectFrom("users").
    select("id").
    where("email", "=", input.email).
    limit(1).
    execute();

    if (existingUser.length > 0) {
      return new Response(superjson.stringify({ error: "Email already in use" }), {
        status: 409
      });
    }

    // Validate referral code
    if (input.referralCode) {
      const referrer = await db.
      selectFrom("users").
      select("id").
      where("bibercode", "=", input.referralCode).
      limit(1).
      execute();
      if (referrer.length === 0) {
        return new Response(superjson.stringify({ error: "Invalid referral code" }), {
          status: 400
        });
      }
    }

    const passwordHash = await generatePasswordHash(input.password);
    const bibercode = await generateUniqueBibercode();
    const displayName = `${input.firstName} ${input.lastName}`;

    let parsedDateOfBirth: Date | null = null;
    if (input.dateOfBirth) {
      parsedDateOfBirth = new Date(input.dateOfBirth);
      if (isNaN(parsedDateOfBirth.getTime())) {
        return new Response(superjson.stringify({ error: "Invalid dateOfBirth" }), { status: 400 });
      }
    }

    // Create user in a transaction
    const newUser = await db.transaction().execute(async (trx) => {
      const [insertedUser] = await trx.
      insertInto("users").
      values({
        email: input.email,
        displayName,
        firstName: input.firstName,
        lastName: input.lastName,
        role: "user",
        emailVerified: true, // Auto-verify admin created users
        bibercode,
        referredByBibercode: input.referralCode || null,
        pointsBalance: 0,
        streetAddress: input.streetAddress || null,
        city: input.city || null,
        postcode: input.postcode || null,
        mobileNumber: input.mobileNumber || null,
        companyName: input.companyName || null,
        salutation: input.salutation || null,
        dateOfBirth: parsedDateOfBirth,
        languagePreference: input.languagePreference || "de",
        notificationPreference: input.notificationPreference || "both"
      }).
      returning(["id"]).
      execute();

      await trx.
      insertInto("userPasswords").
      values({
        userId: insertedUser.id,
        passwordHash
      }).
      execute();

      return insertedUser;
    });

    return new Response(
      superjson.stringify({
        success: true,
        userId: newUser.id
      } satisfies OutputType),
      {
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error: unknown) {
    console.error("Admin customer create error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400
    });
  }
}