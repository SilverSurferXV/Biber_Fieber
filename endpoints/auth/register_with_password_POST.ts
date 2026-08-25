import { db } from "../../helpers/db";
import { schema } from "./register_with_password_POST.schema";
import { randomBytes } from "crypto";
import {
  setServerSession,
  createSessionToken,
  SessionExpirationSeconds,
} from "../../helpers/getSetServerSession";
import { generatePasswordHash } from "../../helpers/generatePasswordHash";
import { User } from "../../helpers/User";
import { checkAndNotifyZoneActivation } from "../../helpers/checkAndNotifyZoneActivation";
import { sendMailjetEmail } from "../../helpers/sendMailjetEmail";
import { replaceTemplateVars } from "../../helpers/replaceTemplateVars";
import { isAdult } from "../../helpers/isAdult";
import superjson from "superjson";

/**
 * Generate a unique bibercode in the format "BIBER-XXXXXXXX"
 * Uses 8 random uppercase alphanumeric characters.
 */
function generateBibercode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(8);
  let code = "BIBER-";
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Generate a unique bibercode, retrying if there is a collision (very unlikely).
 */
async function generateUniqueBibercode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateBibercode();
    const existing = await db
      .selectFrom("users")
      .select("id")
      .where("bibercode", "=", code)
      .limit(1)
      .execute();
    if (existing.length === 0) {
      return code;
    }
    console.log(`Bibercode collision on attempt ${attempt + 1}, retrying...`);
  }
  throw new Error("Failed to generate a unique bibercode after 10 attempts.");
}

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { salutation, email, password, firstName, lastName, postcode, city, streetAddress, mobileNumber, referralCode, dateOfBirth, companyName } = schema.parse(json);

    const displayName = `${firstName} ${lastName}`;
    const validSalutation = salutation ? salutation : null;

    // Check if email already exists
    const existingUser = await db
      .selectFrom("users")
      .select("id")
      .where("email", "=", email)
      .limit(1)
      .execute();

    if (existingUser.length > 0) {
      return new Response(
        superjson.stringify({ message: "Email already in use" }),
        {
          status: 409,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Validate referral code if provided
    let validReferralCode: string | null = null;
    if (referralCode) {
      const referrer = await db
        .selectFrom("users")
        .select("id")
        .where("bibercode", "=", referralCode)
        .limit(1)
        .execute();
      if (referrer.length > 0) {
        // Check if referrer has reached the 20-friend limit
        const friendCount = await db
          .selectFrom("users")
          .select(db.fn.count("id").as("count"))
          .where(db.fn("lower", ["referredByBibercode"]), "=", referralCode.toLowerCase())
          .executeTakeFirstOrThrow();

        if (Number(friendCount.count) >= 20) {
          console.warn(`Referrer has reached maximum 20 friends, ignoring referral code: ${referralCode}`);
          validReferralCode = null;
        } else {
          validReferralCode = referralCode;
        }
      } else {
        console.warn(`Invalid referral code provided, ignoring: ${referralCode}`);
      }
    }

    if (dateOfBirth && !isAdult(dateOfBirth)) {
      return new Response(
        superjson.stringify({ message: "Du musst mindestens 18 Jahre alt sein, um bei uns zu bestellen." }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const passwordHash = await generatePasswordHash(password);
    const bibercode = await generateUniqueBibercode();

    // Create new user within a transaction
    const newUser = await db.transaction().execute(async (trx) => {
      const [user] = await trx
        .insertInto("users")
        .values({
          salutation: validSalutation,
          email,
          displayName,
          firstName,
          lastName,
          postcode: postcode || null,
          city: city || null,
          streetAddress: streetAddress || null,
          mobileNumber: mobileNumber || null,
          role: "user",
          emailVerified: true,
          bibercode,
          companyName: companyName ?? null,
          referredByBibercode: validReferralCode,
          pointsBalance: 0,
         dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
       })
        .returning([
          "id",
          "email",
          "displayName",
          "firstName",
          "lastName",
          "role",
          "avatarUrl",
          "pointsBalance",
          "languagePreference",
          "emailVerified",
          "bibercode",
          "mobileNumber",
        ])
        .execute();

      await trx
        .insertInto("userPasswords")
        .values({
          userId: user.id,
          passwordHash,
        })
        .execute();

      return user;
    });

    // Create a new session
    const sessionId = randomBytes(32).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SessionExpirationSeconds * 1000);

    await db
      .insertInto("sessions")
      .values({
        id: sessionId,
        userId: newUser.id,
        createdAt: now,
        lastAccessed: now,
        expiresAt,
      })
      .execute();

    const userData: User = {
      id: newUser.id,
      email: newUser.email,
      displayName: newUser.displayName,
      avatarUrl: newUser.avatarUrl ?? null,
      role: newUser.role,
      firstName: newUser.firstName ?? null,
      lastName: newUser.lastName ?? null,
      pointsBalance: newUser.pointsBalance != null ? parseFloat(String(newUser.pointsBalance)) : 0,
      languagePreference: newUser.languagePreference ?? "de",
      emailVerified: newUser.emailVerified ?? true,
      bibercode: newUser.bibercode ?? null,
      mobileNumber: newUser.mobileNumber ?? null,
    };

    const sessionToken = await createSessionToken({
      id: sessionId,
      createdAt: now.getTime(),
      lastAccessed: now.getTime(),
    });

    const response = new Response(
      superjson.stringify({ user: userData satisfies User, sessionToken }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    await setServerSession(response, {
      id: sessionId,
      createdAt: now.getTime(),
      lastAccessed: now.getTime(),
    });

    // Fire-and-forget welcome email — does not delay the registration response
    (async () => {
      try {
        const template = await db
          .selectFrom("emailTemplates")
          .selectAll()
          .where("slug", "=", "registration_welcome")
          .executeTakeFirst();

        const vars: Record<string, string> = {
          firstName,
          lastName,
          email,
          bibercode,
          streetAddress: streetAddress || "",
          postcode: postcode || "",
          city: city || "",
        };

        let subject: string;
        let html: string;

        if (template) {
          subject = replaceTemplateVars(template.subject, vars);
          html = replaceTemplateVars(template.htmlBody, vars);
        } else {
          subject = `Willkommen bei Biber Fieber, ${firstName}!`;
          html = `<p>Hallo ${firstName},</p><p>Willkommen bei Biber Fieber! Deine Registrierung war erfolgreich.</p><p>Dein Bibercode: <strong>${bibercode}</strong></p>`;
        }

        await sendMailjetEmail({
          to: [{ email, name: `${firstName} ${lastName}` }],
          subject,
          html,
        });

        console.log(`Welcome email sent to ${email}`);
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
      }
    })();

    // Fire-and-forget zone activation check — does not delay the registration response
    if (postcode) {
      checkAndNotifyZoneActivation(postcode).catch((err) =>
        console.error("Zone activation check failed:", err)
      );
    }

    return response;
  } catch (error: unknown) {
    console.error("Registration error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Registration failed";
    return new Response(
      superjson.stringify({ message: errorMessage }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}