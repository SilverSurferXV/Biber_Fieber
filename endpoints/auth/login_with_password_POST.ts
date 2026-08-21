import { db } from "../../helpers/db";
import { sql } from "kysely";
import { schema } from "./login_with_password_POST.schema";
import { compare } from "bcryptjs";
import { randomBytes } from "crypto";
import {
  setServerSession,
  SessionExpirationSeconds,
} from "../../helpers/getSetServerSession";
import { User } from "../../helpers/User";
import { requestClientInfo } from "../../helpers/requestClientInfo";
import { generatePasswordHash } from "../../helpers/generatePasswordHash";
import { sendPasswordResetEmail } from "../../helpers/sendPasswordResetEmail";
import { pruneLoginAttempts } from "../../helpers/pruneLoginAttempts";
import superjson from "superjson";

const LOCKOUT_MESSAGE = "Zu viele fehlgeschlagene Anmeldeversuche. Aus Sicherheitsgründen wurde dein Passwort zurückgesetzt. Wir haben dir eine E-Mail zum Festlegen eines neuen Passworts geschickt.";
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_MINUTES = 30;

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { email, password, clientPlatform } = schema.parse(json);

    // Normalize email to lowercase for consistent handling
    const normalizedEmail = email.toLowerCase();
    const now = new Date();
    const { ipAddress, userAgent } = requestClientInfo(request);

    const result = await db.transaction().execute(async (trx) => {
      // Use PostgreSQL advisory lock to serialize access per email
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${normalizedEmail},0))`.execute(
        trx
      );

      // Find user by email (normalized) - select all fields needed for User type
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
        .where(sql`LOWER(users.email)`, "=", normalizedEmail)
        .limit(1)
        .execute();

      if (userResults.length === 0) {
        await trx
          .insertInto("loginAttempts")
          .values({
            email: normalizedEmail,
            attemptedAt: now,
            success: false,
            ipAddress,
            userAgent,
            clientPlatform: clientPlatform ?? null,
            loginSource: "web",
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
            email: normalizedEmail,
            attemptedAt: now,
            success: false,
            ipAddress,
            userAgent,
            clientPlatform: clientPlatform ?? null,
            loginSource: "web",
          })
          .execute();

        const failedAttemptsWindow = new Date(
          now.getTime() - LOCKOUT_WINDOW_MINUTES * 60 * 1000
        );

        const failedAttempts = await trx
          .selectFrom("loginAttempts")
          .select(sql<number>`count(*)::int`.as("count"))
          .where(sql`LOWER(email)`, "=", normalizedEmail)
          .where("success", "=", false)
          .where("attemptedAt", ">=", failedAttemptsWindow)
          .executeTakeFirstOrThrow();

        const failedCount = failedAttempts.count;

        if (failedCount >= LOCKOUT_THRESHOLD) {
          console.log(
            `Lockout threshold reached for ${normalizedEmail}: ${failedCount} failed attempts.`
          );

          const recentLockoutToken = await trx
            .selectFrom("passwordResetTokens")
            .select("id")
            .where("userId", "=", user.id)
            .where("used", "=", false)
            .where("createdAt", ">=", failedAttemptsWindow)
            .limit(1)
            .execute();

          if (recentLockoutToken.length > 0) {
            console.log(
              `Lockout already triggered recently for user ${user.id}, skipping new reset.`
            );
            return {
              type: "lockout" as const,
            };
          }

          const randomSecret = randomBytes(32).toString("hex");
          const newPasswordHash = await generatePasswordHash(randomSecret);

          await trx
            .updateTable("userPasswords")
            .set({ passwordHash: newPasswordHash })
            .where("userId", "=", user.id)
            .execute();

          console.log(
            `Password invalidated for user ${user.id} due to too many failed attempts.`
          );

          return {
            type: "lockout_triggered" as const,
            userId: user.id,
            email: user.email,
            firstName: user.firstName,
          };
        }

        return {
          type: "auth_failed" as const,
        };
      }

      // Password is valid - log successful attempt
      await trx
        .insertInto("loginAttempts")
        .values({
          email: normalizedEmail,
          attemptedAt: now,
          success: true,
          userId: user.id,
          ipAddress,
          userAgent,
          clientPlatform: clientPlatform ?? null,
          loginSource: "web",
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
 
   // Prune login attempts to keep only the newest 100 rows
   await pruneLoginAttempts();

    if (result.type === "lockout" || result.type === "lockout_triggered") {
      if (result.type === "lockout_triggered") {
        try {
          await sendPasswordResetEmail({
            userId: result.userId,
            email: result.email,
            firstName: result.firstName,
            origin: new URL(request.url).origin,
            reason: "too_many_failed_attempts",
          });
          console.log(`Lockout reset email sent to ${result.email}.`);
        } catch (emailError) {
          console.error(
            `Failed to send lockout reset email to ${result.email}:`,
            emailError
          );
        }
      }

      return new Response(
        superjson.stringify({ message: LOCKOUT_MESSAGE }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (result.type === "auth_failed") {
      return new Response(
        superjson.stringify({ message: "Invalid email or password" }),
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
    console.error("Login error:", error);
    return new Response(
      superjson.stringify({ message: "Authentication failed" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}