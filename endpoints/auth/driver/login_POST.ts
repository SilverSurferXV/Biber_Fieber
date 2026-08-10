import { db } from "../../../helpers/db";
import { sql } from "kysely";
import { schema } from "./login_POST.schema";
import { compare } from "bcryptjs";
import { randomBytes } from "crypto";
import {
  setServerSession,
  SessionExpirationSeconds,
} from "../../../helpers/getSetServerSession";
import { User } from "../../../helpers/User";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { identifier, password } = schema.parse(json);

    // Normalize identifier for consistent handling
    const normalizedIdentifier = identifier.toLowerCase().trim();
    const now = new Date();

    const result = await db.transaction().execute(async (trx) => {
      // Use PostgreSQL advisory lock to serialize access per identifier
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${normalizedIdentifier},0))`.execute(
        trx
      );

      // Find user by email or mobileNumber AND role = 'driver'
      const userResults = await trx
        .selectFrom("users")
        .innerJoin("userPasswords", "users.id", "userPasswords.userId")
        .select([
          "users.id",
          "users.email",
          "users.displayName",
          "users.avatarUrl",
          "users.role",
          "users.firstName",
          "users.lastName",
          "users.pointsBalance",
          "users.languagePreference",
          "users.emailVerified",
          "users.bibercode",
          "users.mobileNumber",
          "userPasswords.passwordHash",
        ])
        .where("users.role", "=", "driver")
        .where((eb) =>
          eb.or([
            eb(sql`LOWER(users.email)`, "=", normalizedIdentifier),
            eb(sql`LOWER(users.mobile_number)`, "=", normalizedIdentifier),
          ])
        )
        .limit(1)
        .execute();

      if (userResults.length === 0) {
        await trx
          .insertInto("loginAttempts")
          .values({
            email: normalizedIdentifier, // using identifier as email field for tracking
            attemptedAt: now,
            success: false,
          })
          .execute();

        return {
          type: "auth_failed" as const,
        };
      }

      const user = userResults[0];

      // Verify password
      const passwordValid = await compare(password, user.passwordHash);
      if (!passwordValid) {
        await trx
          .insertInto("loginAttempts")
          .values({
            email: normalizedIdentifier,
            attemptedAt: now,
            success: false,
          })
          .execute();

        return {
          type: "auth_failed" as const,
        };
      }

      // Password is valid - log successful attempt
      await trx
        .insertInto("loginAttempts")
        .values({
          email: normalizedIdentifier,
          attemptedAt: now,
          success: true,
        })
        .execute();

      // Create session inside the same transaction to ensure atomicity
      const sessionId = randomBytes(32).toString("hex");
      const expiresAt = new Date(
        now.getTime() + SessionExpirationSeconds * 1000
      );

      await trx
        .insertInto("sessions")
        .values({
          id: sessionId,
          userId: user.id,
          createdAt: now,
          lastAccessed: now,
          expiresAt: expiresAt,
        })
        .execute();

      return {
        type: "success" as const,
        user,
        sessionId,
        sessionCreatedAt: now,
      };
    });

    if (result.type === "auth_failed") {
      return new Response(
        superjson.stringify({ message: "Invalid credentials" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Success case
    const user = result.user;

    const userData: User = {
      id: user.id,
      email: user.email,
      avatarUrl: user.avatarUrl,
      displayName: user.displayName,
      role: user.role,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      pointsBalance: user.pointsBalance != null ? parseFloat(String(user.pointsBalance)) : 0,
      languagePreference: user.languagePreference ?? "de",
      emailVerified: user.emailVerified ?? false,
      bibercode: user.bibercode ?? null,
      mobileNumber: user.mobileNumber ?? null,
    };

    const response = new Response(
      superjson.stringify({ user: userData } satisfies { user: User }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    await setServerSession(response, {
      id: result.sessionId,
      createdAt: result.sessionCreatedAt.getTime(),
      lastAccessed: result.sessionCreatedAt.getTime(),
    });

    return response;
  } catch (error) {
    console.error("Driver login error:", error);
    return new Response(
      superjson.stringify({ message: "Authentication failed" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}