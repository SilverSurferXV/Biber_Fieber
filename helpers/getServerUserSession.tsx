import { db } from "./db";
import { User } from "./User";

import {
  getServerSessionOrThrow,
  NotAuthenticatedError,
} from "./getSetServerSession";

export async function getServerUserSession(request: Request) {
  const session = await getServerSessionOrThrow(request);

  // Query the sessions and users tables in a single join query
  const results = await db
    .selectFrom("sessions")
    .innerJoin("users", "sessions.userId", "users.id")
    .select([
      "sessions.id as sessionId",
      "sessions.createdAt as sessionCreatedAt",
      "sessions.lastAccessed as sessionLastAccessed",
      "users.id",
      "users.email",
      "users.displayName",
      "users.role",
      "users.avatarUrl",
      "users.firstName",
      "users.lastName",
      "users.pointsBalance",
      "users.languagePreference",
      "users.emailVerified",
      "users.bibercode",
      "users.mobileNumber",
    ])
    .where("sessions.id", "=", session.id)
    .limit(1)
    .execute();

  if (results.length === 0) {
    throw new NotAuthenticatedError();
  }

  const result = results[0];
  const user: User = {
    id: result.id,
    email: result.email,
    displayName: result.displayName,
    avatarUrl: result.avatarUrl,
    role: result.role,
    firstName: result.firstName ?? null,
    lastName: result.lastName ?? null,
    pointsBalance: result.pointsBalance != null ? parseFloat(String(result.pointsBalance)) : 0,
    languagePreference: result.languagePreference ?? "de",
    emailVerified: result.emailVerified ?? false,
    bibercode: result.bibercode ?? null,
    mobileNumber: result.mobileNumber ?? null,
  };

  // Update the session's lastAccessed timestamp
  const now = new Date();
  const lastAccessed = result.sessionLastAccessed ? new Date(result.sessionLastAccessed) : new Date(0);
  const fiveMinutes = 5 * 60 * 1000;

  if (now.getTime() - lastAccessed.getTime() >= fiveMinutes) {
    await db
      .updateTable("sessions")
      .set({ lastAccessed: now })
      .where("id", "=", session.id)
      .execute();

    return {
      user: user satisfies User,
      // make sure to update the session in cookie
      session: {
        ...session,
        lastAccessed: now.getTime(),
      },
    };
  }

  return {
    user: user satisfies User,
    session: {
      ...session,
      lastAccessed: lastAccessed.getTime(),
    },
  };
}