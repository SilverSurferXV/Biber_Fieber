import { db } from "./db";

export const LOGIN_ATTEMPTS_RETENTION_LIMIT = 100;

/**
 * Keeps only the newest N login attempt rows and deletes older ones.
 * 
 * @param limit The maximum number of newest login attempts to keep.
 * @returns The number of rows deleted.
 */
export async function pruneLoginAttempts(
  limit: number = LOGIN_ATTEMPTS_RETENTION_LIMIT
): Promise<number> {
  try {
    const result = await db
      .deleteFrom("loginAttempts")
      .where("id", "not in", (qb) =>
        qb
          .selectFrom("loginAttempts")
          .select("id")
          .orderBy("attemptedAt", "desc")
          .orderBy("id", "desc")
          .limit(limit)
      )
      .executeTakeFirst();

    const deletedCount = Number(result.numDeletedRows ?? 0);

    if (deletedCount > 0) {
      console.log(`[pruneLoginAttempts] Deleted ${deletedCount} old login attempt(s).`);
    }

    return deletedCount;
  } catch (error) {
    console.error(
      "[pruneLoginAttempts] Failed to prune login attempts:",
      error instanceof Error ? error.message : "Unknown error"
    );
    // Never throw, fail gracefully
    return 0;
  }
}