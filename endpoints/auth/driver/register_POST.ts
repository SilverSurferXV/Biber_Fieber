import { db } from "../../../helpers/db";
import { schema } from "./register_POST.schema";
import { randomBytes } from "crypto";
import {
  setServerSession,
  SessionExpirationSeconds,
} from "../../../helpers/getSetServerSession";
import { generatePasswordHash } from "../../../helpers/generatePasswordHash";
import { User } from "../../../helpers/User";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { email, password, firstName, lastName, mobileNumber } = schema.parse(json);

    const displayName = `${firstName} ${lastName}`;

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

    const passwordHash = await generatePasswordHash(password);

    // Create new driver within a transaction
    const newUser = await db.transaction().execute(async (trx) => {
      const [user] = await trx
        .insertInto("users")
        .values({
          email,
          displayName,
          firstName,
          lastName,
          mobileNumber,
          role: "driver",
          emailVerified: true, // Auto-verified for drivers
          pointsBalance: 0,
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

    const response = new Response(
      superjson.stringify({ user: userData satisfies User }),
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

    return response;
  } catch (error: unknown) {
    console.error("Driver registration error:", error);
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